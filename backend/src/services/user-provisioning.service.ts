import * as XLSX from 'xlsx';
import { Role, TokenType, CourseStatus, EnrollmentStatus, User, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { PasswordService } from './password.service';
import { AuthTokenService } from './auth-token.service';
import { NotificationService } from './notification.service';
import { emailService } from './email/email.service';
import { AuthError, AdminUserListItemDTO, AdminUserDetailDTO } from '../types/auth.types';
import {
  CourseStudentDTO,
  ImportPreviewResultDTO,
  PreviewRowDTO,
  PreviewSummaryDTO,
  ConfirmRowInput,
  BulkConfirmResultDTO,
  BulkConfirmResultRow,
} from '../types/student-import.types';

export interface CreateTeacherInput {
  name: string;
  email: string;
}

export interface EnrollStudentInput {
  courseId: string;
  studentNumber: string;
  email: string;
  name: string;
  executorUser: { id: string; role: Role; name?: string; email?: string };
}

export class UserProvisioningService {
  /**
   * ADMIN crea un TEACHER con contraseña temporal, token ACCOUNT_ACTIVATION y envío de correo.
   */
  public static async createTeacher(input: CreateTeacherInput) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();

    if (!name) {
      throw new AuthError('El nombre del profesor es requerido', 400, 'BAD_REQUEST');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError('Correo electrónico inválido', 400, 'BAD_REQUEST');
    }

    // Verificar si ya existe el correo
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AuthError('El correo electrónico ya se encuentra registrado en el sistema', 409, 'EMAIL_ALREADY_EXISTS');
    }

    const temporaryPassword = PasswordService.generateTemporaryPassword(12);
    const passwordHash = await PasswordService.hashPassword(temporaryPassword);

    let createdUser: User;
    let rawToken: string;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            role: Role.TEACHER,
            passwordHash,
            mustChangePassword: true,
            activatedAt: null,
            isActive: true,
          },
        });

        const generatedRawToken = AuthTokenService.generateRawToken();
        const tokenHash = AuthTokenService.hashToken(generatedRawToken);
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

        await tx.authToken.create({
          data: {
            userId: user.id,
            type: TokenType.ACCOUNT_ACTIVATION,
            tokenHash,
            expiresAt,
          },
        });

        return { user, rawToken: generatedRawToken };
      });

      createdUser = result.user;
      rawToken = result.rawToken;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AuthError('El correo electrónico ya se encuentra registrado en el sistema', 409, 'EMAIL_ALREADY_EXISTS');
      }
      throw error;
    }

    // Envío de correo posterior al commit DB
    let emailSent = false;
    try {
      emailSent = await emailService.sendAccountInvitation({
        recipientEmail: createdUser.email,
        recipientName: createdUser.name,
        rawToken,
        temporaryPassword,
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Falló el envío de la invitación al profesor:', emailErr);
      emailSent = false;
    }

    return {
      teacher: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        activatedAt: createdUser.activatedAt,
        mustChangePassword: createdUser.mustChangePassword,
      },
      emailSent,
    };
  }

  /**
   * ADMIN lista la información básica de todos los profesores.
   */
  public static async listTeachers() {
    const teachers = await prisma.user.findMany({
      where: { role: Role.TEACHER },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        activatedAt: true,
        mustChangePassword: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return teachers;
  }

  /**
   * Alta manual e inscripción de estudiante a un curso.
   * Reglas:
   * - Preserva matrícula como string (ej. "00123456").
   * - Cursos en FINISHED o ARCHIVED están bloqueados para inscripción.
   * - Matrícula existente con email diferente -> STUDENT_NUMBER_EMAIL_CONFLICT (409).
   * - Email existente con matrícula diferente o usuario no estudiante -> EMAIL_STUDENT_NUMBER_CONFLICT (409).
   * - Estudiante existente e inscrito en el mismo curso -> STUDENT_ALREADY_ENROLLED (409).
   * - Nuevo alumno: crea User, StudentProfile, Enrollment(ACTIVE), AuthToken(ACCOUNT_ACTIVATION 2h) + Email posterior al commit.
   * - Alumno existente (activado o pendiente): crea únicamente Enrollment(ACTIVE).
   */
  public static async enrollStudent(input: EnrollStudentInput) {
    const courseId = input.courseId;
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const studentNumber = input.studentNumber?.trim(); // Preservar ceros iniciales como String

    if (!name) {
      throw new AuthError('El nombre del estudiante es requerido', 400, 'BAD_REQUEST');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError('Correo electrónico inválido', 400, 'BAD_REQUEST');
    }

    if (!studentNumber) {
      throw new AuthError('La matrícula (studentNumber) es requerida', 400, 'BAD_REQUEST');
    }

    // 1. Verificar existencia y estatus del curso
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AuthError('Curso no encontrado', 404, 'COURSE_NOT_FOUND');
    }

    if (course.status === CourseStatus.FINISHED || course.status === CourseStatus.ARCHIVED) {
      throw new AuthError(
        `El curso no está disponible para inscripciones en su estado actual (${course.status})`,
        400,
        'COURSE_NOT_AVAILABLE_FOR_ENROLLMENT'
      );
    }

    // 2. Verificar identidades académicas globales existentes
    const existingProfile = await prisma.studentProfile.findUnique({
      where: { studentNumber },
      include: { user: true },
    });

    const existingUserByEmail = await prisma.user.findUnique({
      where: { email },
      include: { studentProfile: true },
    });

    // Validar conflicto: Matrícula existe pero con email distinto
    if (existingProfile && existingProfile.user.email !== email) {
      throw new AuthError(
        'La matrícula ya pertenece a un alumno con otro correo registrado',
        409,
        'STUDENT_NUMBER_EMAIL_CONFLICT'
      );
    }

    // Validar conflicto: Email existe pero pertenece a otra matrícula o a usuario no STUDENT
    if (existingUserByEmail) {
      if (!existingUserByEmail.studentProfile || existingUserByEmail.studentProfile.studentNumber !== studentNumber) {
        throw new AuthError(
          'El correo electrónico ya está registrado con otra matrícula o usuario',
          409,
          'EMAIL_STUDENT_NUMBER_CONFLICT'
        );
      }
    }

    // Caso A: El alumno ya existe en el sistema (matrícula y email coinciden)
    if (existingProfile) {
      const studentUser = existingProfile.user;

      // Verificar si ya está inscrito en este curso
      const existingEnrollment = await prisma.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId,
            studentId: studentUser.id,
          },
        },
      });

      if (existingEnrollment) {
        if (existingEnrollment.status === EnrollmentStatus.ACTIVE) {
          throw new AuthError('El alumno ya se encuentra inscrito en este curso', 409, 'STUDENT_ALREADY_ENROLLED');
        }
        if (existingEnrollment.status === EnrollmentStatus.COMPLETED) {
          throw new AuthError('El alumno ya ha completado este curso', 409, 'STUDENT_COURSE_COMPLETED');
        }
        if (existingEnrollment.status === EnrollmentStatus.DROPPED) {
          // Reactivar la inscripción existente conservando id e historial
          const enrollment = await prisma.enrollment.update({
            where: { id: existingEnrollment.id },
            data: {
              status: EnrollmentStatus.ACTIVE,
              completedAt: null,
            },
          });

          let emailSent = false;
          try {
            emailSent = await emailService.sendCourseEnrollmentNotification({
              recipientEmail: studentUser.email,
              recipientName: studentUser.name,
              courseName: course.name,
            });
          } catch (emailErr) {
            console.error('[EMAIL ERROR] Falló el envío del correo al estudiante existente:', emailErr);
            emailSent = false;
          }

          return {
            student: {
              id: studentUser.id,
              name: studentUser.name,
              email: studentUser.email,
              studentNumber: existingProfile.studentNumber,
              activatedAt: studentUser.activatedAt,
            },
            enrollment: {
              id: enrollment.id,
              courseId: enrollment.courseId,
              status: enrollment.status,
            },
            isNewStudent: false,
            emailSent,
          };
        }
      }

      // Crear únicamente la inscripción (Enrollment)
      try {
        const enrollment = await prisma.enrollment.create({
          data: {
            courseId,
            studentId: studentUser.id,
            status: EnrollmentStatus.ACTIVE,
          },
        });

        // Enviar correo informativo al estudiante existente posterior al commit DB
        let emailSent = false;
        try {
          emailSent = await emailService.sendCourseEnrollmentNotification({
            recipientEmail: studentUser.email,
            recipientName: studentUser.name,
            courseName: course.name,
          });
        } catch (emailErr) {
          console.error('[EMAIL ERROR] Falló el envío del correo al estudiante existente:', emailErr);
          emailSent = false;
        }

        try {
          const courseTeachers = await prisma.courseTeacher.findMany({
            where: { courseId },
            select: { teacherId: true },
          });
          for (const ct of courseTeachers) {
            await NotificationService.createNotification({
              userId: ct.teacherId,
              type: 'NEW_ENROLLMENT',
              title: 'Nuevo alumno inscrito',
              message: `${studentUser.name} fue inscrito en ${course.name}.`,
              link: `/app/students`,
            });
          }
        } catch (notifErr) {
          console.error('[NOTIFICATION ERROR] Failed to dispatch NEW_ENROLLMENT:', notifErr);
        }

        return {
          student: {
            id: studentUser.id,
            name: studentUser.name,
            email: studentUser.email,
            studentNumber: existingProfile.studentNumber,
            activatedAt: studentUser.activatedAt,
          },
          enrollment: {
            id: enrollment.id,
            courseId: enrollment.courseId,
            status: enrollment.status,
          },
          isNewStudent: false,
          emailSent,
        };
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AuthError('El alumno ya se encuentra inscrito en este curso', 409, 'STUDENT_ALREADY_ENROLLED');
        }
        throw error;
      }
    }

    // Caso B: El alumno NO existe en el sistema -> STUDENT Nuevo
    const temporaryPassword = PasswordService.generateTemporaryPassword(12);
    const passwordHash = await PasswordService.hashPassword(temporaryPassword);

    let createdUser: User;
    let createdProfile: any;
    let createdEnrollment: any;
    let rawToken: string;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            role: Role.STUDENT,
            passwordHash,
            mustChangePassword: true,
            activatedAt: null,
            isActive: true,
          },
        });

        const profile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            studentNumber,
          },
        });

        const enrollment = await tx.enrollment.create({
          data: {
            courseId,
            studentId: user.id,
            status: EnrollmentStatus.ACTIVE,
          },
        });

        const generatedRawToken = AuthTokenService.generateRawToken();
        const tokenHash = AuthTokenService.hashToken(generatedRawToken);
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

        await tx.authToken.create({
          data: {
            userId: user.id,
            type: TokenType.ACCOUNT_ACTIVATION,
            tokenHash,
            expiresAt,
          },
        });

        return { user, profile, enrollment, rawToken: generatedRawToken };
      });

      createdUser = result.user;
      createdProfile = result.profile;
      createdEnrollment = result.enrollment;
      rawToken = result.rawToken;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const targetStr = JSON.stringify(error.meta?.target || '').toLowerCase();
        if (targetStr.includes('email')) {
          throw new AuthError('El correo electrónico ya se encuentra registrado', 409, 'EMAIL_STUDENT_NUMBER_CONFLICT');
        }
        if (targetStr.includes('studentnumber')) {
          throw new AuthError('La matrícula ya se encuentra registrada', 409, 'STUDENT_NUMBER_EMAIL_CONFLICT');
        }
        if (targetStr.includes('course') || targetStr.includes('student') || targetStr.includes('enrollment')) {
          throw new AuthError('El alumno ya se encuentra inscrito en este curso', 409, 'STUDENT_ALREADY_ENROLLED');
        }
        throw new AuthError('El alumno ya se encuentra inscrito en este curso', 409, 'STUDENT_ALREADY_ENROLLED');
      }
      throw error;
    }

    // Envío de correo posterior al commit DB
    let emailSent = false;
    try {
      emailSent = await emailService.sendAccountInvitation({
        recipientEmail: createdUser.email,
        recipientName: createdUser.name,
        courseName: course.name,
        rawToken,
        temporaryPassword,
      });
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Falló el envío de la invitación al estudiante:', emailErr);
      emailSent = false;
    }

    try {
      const courseTeachers = await prisma.courseTeacher.findMany({
        where: { courseId },
        select: { teacherId: true },
      });
      for (const ct of courseTeachers) {
        await NotificationService.createNotification({
          userId: ct.teacherId,
          type: 'NEW_ENROLLMENT',
          title: 'Nuevo alumno inscrito',
          message: `${createdUser.name} fue inscrito en ${course.name}.`,
          link: `/app/students`,
        });
      }
    } catch (notifErr) {
      console.error('[NOTIFICATION ERROR] Failed to dispatch NEW_ENROLLMENT:', notifErr);
    }

    return {
      student: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        studentNumber: createdProfile.studentNumber,
        activatedAt: createdUser.activatedAt,
      },
      enrollment: {
        id: createdEnrollment.id,
        courseId: createdEnrollment.courseId,
        status: createdEnrollment.status,
      },
      isNewStudent: true,
      emailSent,
    };
  }

  /**
   * Obtiene la lista de estudiantes inscritos en un curso con estados derivados en tiempo real.
   */
  public static async getCourseStudents(courseId: string): Promise<CourseStudentDTO[]> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AuthError('Curso no encontrado', 404, 'COURSE_NOT_FOUND');
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        status: EnrollmentStatus.ACTIVE,
      },
      include: {
        student: {
          include: {
            studentProfile: true,
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const studentIds = enrollments.map((e) => e.studentId);

    const activeTokens = await prisma.authToken.findMany({
      where: {
        userId: { in: studentIds },
        type: TokenType.ACCOUNT_ACTIVATION,
        revokedAt: null,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true },
    });
    const activeTokenUserIds = new Set(activeTokens.map((t) => t.userId));

    const pastTokens = await prisma.authToken.findMany({
      where: {
        userId: { in: studentIds },
        type: TokenType.ACCOUNT_ACTIVATION,
      },
      select: { userId: true },
    });
    const pastTokenUserIds = new Set(pastTokens.map((t) => t.userId));

    return enrollments.map((e) => {
      const student = e.student;
      const profile = student.studentProfile;

      let accountStatus: 'ACTIVE' | 'PENDING' | 'EXPIRED' = 'EXPIRED';
      if (student.activatedAt !== null) {
        accountStatus = 'ACTIVE';
      } else if (activeTokenUserIds.has(student.id)) {
        accountStatus = 'PENDING';
      } else if (pastTokenUserIds.has(student.id)) {
        accountStatus = 'EXPIRED';
      }

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        studentNumber: profile?.studentNumber || '',
        enrollmentStatus: e.status,
        accountStatus,
        invitationStatus: accountStatus,
        activatedAt: student.activatedAt,
        enrolledAt: e.enrolledAt,
      };
    });
  }

  /**
   * Busca estudiantes registrados en la plataforma para asociar a un curso (por nombre, matrícula o correo).
   */
  public static async searchStudentsForCourse(courseId: string, query: string): Promise<{
    id: string;
    name: string;
    email: string;
    studentNumber: string;
    isAlreadyEnrolled: boolean;
  }[]> {
    const q = query?.trim();
    if (!q || q.length === 0) {
      return [];
    }

    const students = await prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { studentProfile: { studentNumber: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentProfile: {
          select: {
            studentNumber: true,
          },
        },
        enrollments: {
          where: { courseId, status: EnrollmentStatus.ACTIVE },
          select: { id: true },
        },
      },
      take: 20,
    });

    return students.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      studentNumber: s.studentProfile?.studentNumber || '',
      isAlreadyEnrolled: s.enrollments.length > 0,
    }));
  }

  /**
   * Previsualiza e inspecciona un archivo Excel (.xlsx) sin mutar la base de datos.
   */
  public static async previewExcelImport(courseId: string, fileBuffer: Buffer): Promise<ImportPreviewResultDTO> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AuthError('Curso no encontrado', 404, 'COURSE_NOT_FOUND');
    }

    if (course.status === CourseStatus.FINISHED || course.status === CourseStatus.ARCHIVED) {
      throw new AuthError(
        `El curso no está disponible para inscripciones en su estado actual (${course.status})`,
        400,
        'COURSE_NOT_AVAILABLE_FOR_ENROLLMENT'
      );
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AuthError('El archivo provisto está vacío o no es un archivo válido', 400, 'INVALID_IMPORT_FILE');
    }

    if (fileBuffer.length > 5 * 1024 * 1024) {
      throw new AuthError('El archivo excede el tamaño máximo permitido (5MB)', 400, 'IMPORT_TOO_LARGE');
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new AuthError('El archivo no tiene el formato esperado (.xlsx válido)', 400, 'INVALID_IMPORT_FILE');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new AuthError('El archivo Excel no contiene hojas de trabajo', 400, 'INVALID_IMPORT_FILE');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      throw new AuthError('El archivo no contiene filas de datos', 400, 'INVALID_IMPORT_FILE');
    }

    if (rawData.length > 500) {
      throw new AuthError('El archivo excede el límite máximo de 500 registros por importación', 400, 'IMPORT_TOO_LARGE');
    }

    const sampleRow = rawData[0];
    const rawKeys = Object.keys(sampleRow);

    let nameColKey: string | null = null;
    let studentNumberColKey: string | null = null;
    let emailColKey: string | null = null;

    for (const key of rawKeys) {
      const normalizedKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (['nombre', 'name', 'nombre completo'].includes(normalizedKey)) {
        nameColKey = key;
      } else if (['matricula', 'studentnumber', 'num_control', 'num control', 'boleta'].includes(normalizedKey)) {
        studentNumberColKey = key;
      } else if (['correo', 'email', 'correo electronico', 'mail'].includes(normalizedKey)) {
        emailColKey = key;
      }
    }

    if (!nameColKey || !studentNumberColKey || !emailColKey) {
      throw new AuthError(
        'El archivo debe incluir las columnas: nombre, matrícula y correo.',
        400,
        'IMPORT_REQUIRED_COLUMNS_MISSING'
      );
    }

    const allProfiles = await prisma.studentProfile.findMany({
      include: { user: true },
    });
    const profileByStudentNumberMap = new Map(allProfiles.map((p) => [p.studentNumber, p]));

    const allUsers = await prisma.user.findMany({
      include: { studentProfile: true },
    });
    const userByEmailMap = new Map(allUsers.map((u) => [u.email.toLowerCase(), u]));

    const currentEnrollments = await prisma.enrollment.findMany({
      where: { courseId, status: EnrollmentStatus.ACTIVE },
      select: { studentId: true },
    });
    const enrolledStudentIds = new Set(currentEnrollments.map((e) => e.studentId));

    const duplicateStudentNumbersInFile = new Set<string>();
    const studentNumCounts = new Map<string, number>();
    rawData.forEach((row) => {
      const sn = String(row[studentNumberColKey!] ?? '').trim();
      if (sn) studentNumCounts.set(sn, (studentNumCounts.get(sn) || 0) + 1);
    });
    studentNumCounts.forEach((count, sn) => {
      if (count > 1) duplicateStudentNumbersInFile.add(sn);
    });

    const duplicateEmailsInFile = new Set<string>();
    const emailCounts = new Map<string, number>();
    rawData.forEach((row) => {
      const em = String(row[emailColKey!] ?? '').trim().toLowerCase();
      if (em) emailCounts.set(em, (emailCounts.get(em) || 0) + 1);
    });
    emailCounts.forEach((count, em) => {
      if (count > 1) duplicateEmailsInFile.add(em);
    });

    const rows: PreviewRowDTO[] = [];
    const summary: PreviewSummaryDTO = {
      total: rawData.length,
      new: 0,
      existingToEnroll: 0,
      alreadyEnrolled: 0,
      conflicts: 0,
      invalid: 0,
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    rawData.forEach((row, idx) => {
      const rowNumber = idx + 2;
      const name = String(row[nameColKey!] ?? '').trim();
      const studentNumber = String(row[studentNumberColKey!] ?? '').trim();
      const email = String(row[emailColKey!] ?? '').trim().toLowerCase();

      if (!name) {
        rows.push({
          rowNumber,
          name,
          studentNumber,
          email,
          status: 'INVALID',
          reasonCode: 'MISSING_NAME',
          message: 'El nombre es obligatorio.',
        });
        summary.invalid++;
        return;
      }

      if (!studentNumber) {
        rows.push({
          rowNumber,
          name,
          studentNumber,
          email,
          status: 'INVALID',
          reasonCode: 'MISSING_STUDENT_NUMBER',
          message: 'La matrícula es obligatoria.',
        });
        summary.invalid++;
        return;
      }

      if (!email) {
        rows.push({
          rowNumber,
          name,
          studentNumber,
          email,
          status: 'INVALID',
          reasonCode: 'MISSING_EMAIL',
          message: 'El correo electrónico es obligatorio.',
        });
        summary.invalid++;
        return;
      }

      if (!emailRegex.test(email)) {
        rows.push({
          rowNumber,
          name,
          studentNumber,
          email,
          status: 'INVALID',
          reasonCode: 'INVALID_EMAIL',
          message: 'El formato de correo electrónico no es válido.',
        });
        summary.invalid++;
        return;
      }

      if (duplicateStudentNumbersInFile.has(studentNumber)) {
        rows.push({
          rowNumber,
          name,
          studentNumber,
          email,
          status: 'INVALID',
          reasonCode: 'DUPLICATE_STUDENT_NUMBER_IN_FILE',
          message: 'La matrícula está duplicada dentro del mismo archivo.',
        });
        summary.invalid++;
        return;
      }

      if (duplicateEmailsInFile.has(email)) {
        rows.push({
          rowNumber,
          name,
          studentNumber,
          email,
          status: 'INVALID',
          reasonCode: 'DUPLICATE_EMAIL_IN_FILE',
          message: 'El correo electrónico está duplicado dentro del mismo archivo.',
        });
        summary.invalid++;
        return;
      }

      const dbProfile = profileByStudentNumberMap.get(studentNumber);
      const dbUserByEmail = userByEmailMap.get(email);

      if (dbProfile) {
        if (dbProfile.user.email.toLowerCase() !== email) {
          rows.push({
            rowNumber,
            name,
            studentNumber,
            email,
            status: 'CONFLICT',
            reasonCode: 'STUDENT_NUMBER_EMAIL_CONFLICT',
            message: `La matrícula ya pertenece a un alumno con otro correo registrado (${dbProfile.user.email}).`,
          });
          summary.conflicts++;
          return;
        }

        if (enrolledStudentIds.has(dbProfile.userId)) {
          rows.push({
            rowNumber,
            name,
            studentNumber,
            email,
            status: 'ALREADY_ENROLLED',
            reasonCode: 'STUDENT_ALREADY_ENROLLED',
            message: 'El alumno ya se encuentra inscrito en este curso.',
          });
          summary.alreadyEnrolled++;
          return;
        }

        rows.push({
          rowNumber,
          name,
          studentNumber,
          email,
          status: 'EXISTING_TO_ENROLL',
          message: 'Alumno existente en la plataforma — listo para inscribirse al curso.',
        });
        summary.existingToEnroll++;
        return;
      }

      if (dbUserByEmail) {
        rows.push({
          rowNumber,
          name,
          studentNumber,
          email,
          status: 'CONFLICT',
          reasonCode: 'EMAIL_STUDENT_NUMBER_CONFLICT',
          message: 'El correo electrónico ya pertenece a otro usuario registrado.',
        });
        summary.conflicts++;
        return;
      }

      rows.push({
        rowNumber,
        name,
        studentNumber,
        email,
        status: 'NEW',
        message: 'Alumno nuevo — se creará su cuenta y se enviará invitación.',
      });
      summary.new++;
    });

    return { summary, rows };
  }

  /**
   * Confirma e inscribe masivamente un conjunto de alumnos revalidando el estado en DB.
   */
  public static async confirmBulkEnrollment(courseId: string, rows: ConfirmRowInput[]): Promise<BulkConfirmResultDTO> {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AuthError('Curso no encontrado', 404, 'COURSE_NOT_FOUND');
    }

    if (course.status === CourseStatus.FINISHED || course.status === CourseStatus.ARCHIVED) {
      throw new AuthError(
        `El curso no está disponible para inscripciones en su estado actual (${course.status})`,
        400,
        'COURSE_NOT_AVAILABLE_FOR_ENROLLMENT'
      );
    }

    if (!rows || rows.length === 0) {
      throw new AuthError('No se proporcionaron filas para procesar', 400, 'BAD_REQUEST');
    }

    const results: BulkConfirmResultRow[] = [];
    let createdCount = 0;
    let enrolledExistingCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const name = row.name?.trim();
      const email = row.email?.trim().toLowerCase();
      const studentNumber = row.studentNumber?.trim();

      if (!name || !email || !studentNumber) {
        results.push({
          studentNumber: studentNumber || '',
          email: email || '',
          name: name || '',
          status: 'SKIPPED_INVALID',
          emailSent: false,
          message: 'Datos incompletos',
        });
        skippedCount++;
        continue;
      }

      try {
        const enrollResult = await UserProvisioningService.enrollStudent({
          courseId,
          name,
          email,
          studentNumber,
          executorUser: { id: 'bulk-import', role: Role.ADMIN },
        });

        if (enrollResult.isNewStudent) {
          createdCount++;
          results.push({
            studentNumber,
            email,
            name,
            status: 'CREATED',
            emailSent: enrollResult.emailSent ?? false,
            message: 'Alumno nuevo creado e inscrito exitosamente.',
          });
        } else {
          enrolledExistingCount++;
          results.push({
            studentNumber,
            email,
            name,
            status: 'ENROLLED',
            emailSent: enrollResult.emailSent ?? false,
            message: 'Alumno existente inscrito al curso.',
          });
        }
      } catch (error: any) {
        if (error instanceof AuthError) {
          if (error.code === 'STUDENT_ALREADY_ENROLLED') {
            results.push({
              studentNumber,
              email,
              name,
              status: 'SKIPPED_ALREADY_ENROLLED',
              emailSent: false,
              message: error.message,
            });
          } else if (error.code === 'STUDENT_NUMBER_EMAIL_CONFLICT' || error.code === 'EMAIL_STUDENT_NUMBER_CONFLICT') {
            results.push({
              studentNumber,
              email,
              name,
              status: 'SKIPPED_CONFLICT',
              emailSent: false,
              message: error.message,
            });
          } else {
            results.push({
              studentNumber,
              email,
              name,
              status: 'SKIPPED_INVALID',
              emailSent: false,
              message: error.message,
            });
          }
        } else {
          results.push({
            studentNumber,
            email,
            name,
            status: 'SKIPPED_INVALID',
            emailSent: false,
            message: 'Error inesperado al procesar el registro',
          });
        }
        skippedCount++;
      }
    }

    return {
      totalProcessed: rows.length,
      createdCount,
      enrolledExistingCount,
      skippedCount,
      results,
    };
  }

  /**
   * ADMIN: Obtener listado de todos los usuarios registrados en el sistema.
   */
  public static async listUsers(): Promise<AdminUserListItemDTO[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        activatedAt: true,
        lastLoginAt: true,
        createdAt: true,
        studentProfile: {
          select: {
            studentNumber: true,
          },
        },
      },
    });

    return users;
  }

  /**
   * ADMIN creates a new user (TEACHER or STUDENT).
   * For STUDENT, a studentNumber must be provided and will be stored in StudentProfile.
   * No enrollment is performed.
   */
  public static async createUserAdmin(input: { role: Role; name: string; email: string; studentNumber?: string }) {
    const { role, name: rawName, email: rawEmail, studentNumber: rawStudentNumber } = input;
    const name = rawName?.trim();
    const email = rawEmail?.trim().toLowerCase();
    const studentNumber = rawStudentNumber?.trim();

    // Validate role
    if (role !== Role.ADMIN && role !== Role.TEACHER && role !== Role.STUDENT) {
      throw new AuthError('El rol debe ser ADMIN, TEACHER o STUDENT', 400, 'BAD_REQUEST');
    }

    if (!name) {
      throw new AuthError('El nombre es requerido', 400, 'BAD_REQUEST');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError('Correo electrónico inválido', 400, 'BAD_REQUEST');
    }
    if (role === Role.STUDENT && (!studentNumber || studentNumber.length === 0)) {
      throw new AuthError('La matrícula es requerida para usuarios STUDENT', 400, 'BAD_REQUEST');
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AuthError('El correo electrónico ya está registrado', 409, 'EMAIL_ALREADY_EXISTS');
    }

    // Check studentNumber uniqueness if STUDENT
    if (role === Role.STUDENT) {
      const existingProfile = await prisma.studentProfile.findUnique({ where: { studentNumber } });
      if (existingProfile) {
        throw new AuthError('La matrícula ya está registrada', 409, 'STUDENT_NUMBER_EXISTS');
      }
    }

    const temporaryPassword = PasswordService.generateTemporaryPassword(12);
    const passwordHash = await PasswordService.hashPassword(temporaryPassword);

    let createdUser!: User;
    let rawToken!: string;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          role,
          passwordHash,
          mustChangePassword: true,
          activatedAt: null,
          isActive: true,
        },
      });
      createdUser = user;

      if (role === Role.STUDENT) {
        await tx.studentProfile.create({
          data: {
            userId: user.id,
            studentNumber: studentNumber!,
          },
        });
      }

      const generatedRawToken = AuthTokenService.generateRawToken();
      const tokenHash = AuthTokenService.hashToken(generatedRawToken);
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      await tx.authToken.create({
        data: {
          userId: user.id,
          type: TokenType.ACCOUNT_ACTIVATION,
          tokenHash,
          expiresAt,
        },
      });

      rawToken = generatedRawToken;
    });

    // Send invitation email (non‑blocking failure is tolerated)
    let emailSent = false;
    try {
      emailSent = await emailService.sendAccountInvitation({
        recipientEmail: createdUser.email,
        recipientName: createdUser.name,
        rawToken,
        temporaryPassword,
      });
    } catch (e) {
      console.error('[EMAIL ERROR] Invitation email failed for admin‑created user', e);
    }

    return {
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        activatedAt: createdUser.activatedAt,
        mustChangePassword: createdUser.mustChangePassword,
      },
      emailSent,
    };
  }

  /**
   * ADMIN: Obtener detalle completo de un usuario por su ID.
   */
  public static async getUserById(userId: string): Promise<AdminUserDetailDTO> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        activatedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        studentProfile: {
          select: {
            studentNumber: true,
          },
        },
      },
    });

    if (!user) {
      throw new AuthError('Usuario no encontrado en el sistema', 404, 'USER_NOT_FOUND');
    }

    return user;
  }

  /**
   * ADMIN: Actualización administrativa de identidad de un usuario.
   */
  public static async updateUserAdmin(targetUserId: string, body: any): Promise<AdminUserDetailDTO> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new AuthError('Payload de actualización administrativa inválido', 400, 'BAD_REQUEST');
    }

    const allowedKeys = ['name', 'email', 'studentNumber', 'isActive'];
    const bodyKeys = Object.keys(body);
    const invalidKeys = bodyKeys.filter((k) => !allowedKeys.includes(k));

    if (invalidKeys.length > 0) {
      throw new AuthError(
        `Payload de actualización contiene campos no permitidos: ${invalidKeys.join(', ')}`,
        400,
        'BAD_REQUEST'
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { studentProfile: true },
    });

    if (!targetUser) {
      throw new AuthError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    }

    const userUpdates: Prisma.UserUpdateInput = {};
    let newStudentNumber: string | undefined = undefined;

    // 1. Validar y procesar name
    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        throw new AuthError('El nombre debe ser una cadena de texto', 400, 'BAD_REQUEST');
      }
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        throw new AuthError('El nombre no puede estar vacío', 400, 'BAD_REQUEST');
      }
      if (trimmedName.length > 100) {
        throw new AuthError('El nombre excede el límite máximo de 100 caracteres', 400, 'BAD_REQUEST');
      }
      userUpdates.name = trimmedName;
    }

    // 2. Validar y procesar email
    if (body.email !== undefined) {
      if (typeof body.email !== 'string') {
        throw new AuthError('El correo debe ser una cadena de texto', 400, 'BAD_REQUEST');
      }
      const trimmedEmail = body.email.trim().toLowerCase();
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new AuthError('Correo electrónico inválido', 400, 'BAD_REQUEST');
      }

      if (trimmedEmail !== targetUser.email) {
        const existingEmail = await prisma.user.findFirst({
          where: {
            email: trimmedEmail,
            id: { not: targetUserId },
          },
        });
        if (existingEmail) {
          throw new AuthError(
            'El correo electrónico ya se encuentra registrado por otro usuario',
            409,
            'EMAIL_ALREADY_EXISTS'
          );
        }
        userUpdates.email = trimmedEmail;
      }
    }

    // 3. Validar y procesar isActive
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        throw new AuthError('El estado de cuenta (isActive) debe ser un valor booleano', 400, 'BAD_REQUEST');
      }
      userUpdates.isActive = body.isActive;
    }

    // 4. Validar y procesar studentNumber
    if (body.studentNumber !== undefined) {
      if (targetUser.role !== Role.STUDENT) {
        throw new AuthError('La matrícula únicamente aplica a usuarios con rol STUDENT', 400, 'BAD_REQUEST');
      }

      const cleanMatricula = String(body.studentNumber).trim();
      if (!cleanMatricula) {
        throw new AuthError('La matrícula no puede estar vacía', 400, 'BAD_REQUEST');
      }

      const currentMatricula = targetUser.studentProfile?.studentNumber;
      if (cleanMatricula !== currentMatricula) {
        const existingMatricula = await prisma.studentProfile.findFirst({
          where: {
            studentNumber: cleanMatricula,
            userId: { not: targetUserId },
          },
        });
        if (existingMatricula) {
          throw new AuthError(
            'La matrícula ya se encuentra registrada por otro alumno',
            409,
            'STUDENT_NUMBER_EXISTS'
          );
        }
        newStudentNumber = cleanMatricula;
      }
    }

    // Ejecutar mutaciones atómicas en $transaction
    await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdates).length > 0) {
        await tx.user.update({
          where: { id: targetUserId },
          data: userUpdates,
        });
      }

      if (newStudentNumber !== undefined) {
        if (targetUser.studentProfile) {
          await tx.studentProfile.update({
            where: { userId: targetUserId },
            data: { studentNumber: newStudentNumber },
          });
        } else {
          await tx.studentProfile.create({
            data: {
              userId: targetUserId,
              studentNumber: newStudentNumber,
            },
          });
        }
      }
    });

    return this.getUserById(targetUserId);
  }

  /**
   * ADMIN: Restablecimiento de acceso de cualquier usuario (TEACHER o STUDENT).
   */
  public static async resetUserAccessAdmin(userId: string): Promise<{ message: string; emailSent: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthError('Usuario no encontrado en el sistema', 404, 'USER_NOT_FOUND');
    }

    const { rawToken, tempPassword } = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Revocar tokens de reset anteriores
      await tx.authToken.updateMany({
        where: {
          userId: user.id,
          type: TokenType.PASSWORD_RESET,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      // Revocar TODAS las sesiones de refresh de este usuario
      await tx.refreshSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      // Generar nueva contraseña temporal de 8 caracteres
      const tempPassword = PasswordService.generateTemporaryPassword(8);
      const tempPasswordHash = await PasswordService.hashPassword(tempPassword);

      // Actualizar hash y forzar cambio obligatorio en el siguiente inicio de sesión
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: tempPasswordHash,
          mustChangePassword: true,
        },
      });

      // Crear nuevo AuthToken de restablecimiento de contraseña (exp 24 horas)
      const rawToken = AuthTokenService.generateRawToken();
      const tokenHash = AuthTokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await tx.authToken.create({
        data: {
          userId: user.id,
          type: TokenType.PASSWORD_RESET,
          tokenHash,
          expiresAt,
        },
      });

      return { rawToken, tempPassword };
    });

    let emailSent = false;
    try {
      emailSent = await emailService.sendPasswordReset({
        recipientEmail: user.email,
        recipientName: user.name,
        rawToken,
        temporaryPassword: tempPassword,
      });
    } catch (e) {
      console.error('[EMAIL ERROR] Reset access email failed for user', e);
      emailSent = false;
    }

    return {
      message: emailSent
        ? 'Contraseña y acceso restablecidos correctamente. Se ha enviado un correo con la nueva contraseña temporal.'
        : 'Restablecimiento de acceso generado exitosamente. El servicio de correo no pudo entregar el mensaje.',
      emailSent,
    };
  }

  /**
   * Retira lógicamente a un alumno de un curso cambiando su estado de Enrollment a DROPPED.
   * Se preserva el usuario, perfil e historial académico completo (lecciones, intentos, respuestas, notas).
   */
  public static async dropStudent(courseId: string, studentId: string) {
    if (!courseId || typeof courseId !== 'string') {
      throw new AuthError('Identificador de curso no válido', 400, 'INVALID_COURSE_ID');
    }

    if (!studentId || typeof studentId !== 'string') {
      throw new AuthError('Identificador de estudiante no válido', 400, 'INVALID_STUDENT_ID');
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AuthError('El curso especificado no existe', 404, 'COURSE_NOT_FOUND');
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId,
          studentId,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new AuthError('El alumno no se encuentra inscrito en este curso', 404, 'ENROLLMENT_NOT_FOUND');
    }

    if (enrollment.status === EnrollmentStatus.COMPLETED) {
      throw new AuthError('No se puede retirar a un alumno de un curso ya completado', 400, 'ENROLLMENT_ALREADY_COMPLETED');
    }

    if (enrollment.status === EnrollmentStatus.DROPPED) {
      return {
        message: 'El alumno ya se encontraba retirado de este curso',
        enrollment,
      };
    }

    const updatedEnrollment = await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: EnrollmentStatus.DROPPED,
        completedAt: null,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      message: `Alumno ${enrollment.student.name} retirado del curso exitosamente`,
      enrollment: updatedEnrollment,
    };
  }
}
