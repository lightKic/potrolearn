import { EnrollmentStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { NotificationService } from './notification.service';

export class ScheduledPublishService {
  private static timer: NodeJS.Timeout | null = null;
  private static isChecking: boolean = false;

  /**
   * Revisa y activa atómicamente todos los contenidos pedagógicos (Módulos, Lecciones, Evaluaciones)
   * cuya fecha scheduledPublishAt <= NOW() en cursos activos.
   */
  public static async checkAndPublishScheduledContent(): Promise<{
    publishedModules: number;
    publishedLessons: number;
    publishedAssessments: number;
  }> {
    if (this.isChecking) {
      return { publishedModules: 0, publishedLessons: 0, publishedAssessments: 0 };
    }

    this.isChecking = true;
    let publishedModulesCount = 0;
    let publishedLessonsCount = 0;
    let publishedAssessmentsCount = 0;

    try {
      const now = new Date();

      // 1. Módulos programados
      const pendingModules = await prisma.module.findMany({
        where: {
          isPublished: false,
          scheduledPublishAt: { lte: now },
          course: {
            status: 'ACTIVE',
          },
        },
        select: {
          id: true,
          title: true,
          courseId: true,
          course: { select: { name: true } },
        },
      });

      for (const m of pendingModules) {
        const res = await prisma.module.updateMany({
          where: {
            id: m.id,
            isPublished: false,
            scheduledPublishAt: { lte: now },
          },
          data: {
            isPublished: true,
            publishedAt: now,
            scheduledPublishAt: null,
          },
        });

        if (res.count === 1) {
          publishedModulesCount++;
          await this.notifyCourseStudents(
            m.courseId,
            'MODULE_PUBLISHED',
            'Nuevo módulo disponible',
            `El módulo "${m.title}" ya está disponible en ${m.course.name}.`,
            `/app/courses/${m.courseId}`
          );
        }
      }

      // 2. Lecciones programadas
      const pendingLessons = await prisma.lesson.findMany({
        where: {
          isPublished: false,
          scheduledPublishAt: { lte: now },
          module: {
            course: {
              status: 'ACTIVE',
            },
          },
        },
        select: {
          id: true,
          title: true,
          moduleId: true,
          module: {
            select: {
              courseId: true,
              course: { select: { name: true } },
            },
          },
        },
      });

      for (const l of pendingLessons) {
        const res = await prisma.lesson.updateMany({
          where: {
            id: l.id,
            isPublished: false,
            scheduledPublishAt: { lte: now },
          },
          data: {
            isPublished: true,
            publishedAt: now,
            scheduledPublishAt: null,
          },
        });

        if (res.count === 1) {
          publishedLessonsCount++;
          await this.notifyCourseStudents(
            l.module.courseId,
            'LESSON_PUBLISHED',
            'Nueva lección disponible',
            `Se publicó la lección "${l.title}" en ${l.module.course.name}.`,
            `/app/courses/${l.module.courseId}/modules/${l.moduleId}/lessons/${l.id}`
          );
        }
      }

      // 3. Evaluaciones programadas
      const pendingAssessments = await prisma.assessment.findMany({
        where: {
          isPublished: false,
          scheduledPublishAt: { lte: now },
          course: {
            status: 'ACTIVE',
          },
        },
        select: {
          id: true,
          title: true,
          courseId: true,
          course: { select: { name: true } },
        },
      });

      for (const a of pendingAssessments) {
        const res = await prisma.assessment.updateMany({
          where: {
            id: a.id,
            isPublished: false,
            scheduledPublishAt: { lte: now },
          },
          data: {
            isPublished: true,
            publishedAt: now,
            scheduledPublishAt: null,
          },
        });

        if (res.count === 1) {
          publishedAssessmentsCount++;
          await this.notifyCourseStudents(
            a.courseId,
            'ASSESSMENT_PUBLISHED',
            'Nueva evaluación disponible',
            `Se ha publicado la evaluación "${a.title}" en ${a.course.name}.`,
            `/app/courses/${a.courseId}`
          );
        }
      }
    } catch (error) {
      console.error('[SCHEDULED PUBLISH SERVICE ERROR]:', error);
    } finally {
      this.isChecking = false;
    }

    return {
      publishedModules: publishedModulesCount,
      publishedLessons: publishedLessonsCount,
      publishedAssessments: publishedAssessmentsCount,
    };
  }

  /**
   * Helper para notificar a los alumnos inscritos activamente en el curso.
   */
  private static async notifyCourseStudents(
    courseId: string,
    type: string,
    title: string,
    message: string,
    link: string
  ) {
    try {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: EnrollmentStatus.ACTIVE },
        select: { studentId: true },
      });
      for (const envObj of enrollments) {
        await NotificationService.createNotification({
          userId: envObj.studentId,
          type,
          title,
          message,
          link,
        });
      }
    } catch (err) {
      console.error(`[SCHEDULED PUBLISH NOTIFICATION ERROR] ${type}:`, err);
    }
  }

  /**
   * Inicia el worker de publicación programada en background.
   */
  public static start(intervalMs: number = 5000): void {
    if (!env.enableScheduledPublish) {
      console.log('[SCHEDULED PUBLISH] Servicio deshabilitado por variable de entorno (ENABLE_SCHEDULED_PUBLISH=false).');
      return;
    }

    console.log(`[SCHEDULED PUBLISH] Iniciando servicio de publicación programada (Intervalo: ${intervalMs / 1000}s)...`);

    // Ejecución inicial al arrancar
    this.checkAndPublishScheduledContent().then((res) => {
      if (res.publishedModules + res.publishedLessons + res.publishedAssessments > 0) {
        console.log(`[SCHEDULED PUBLISH INITIAL SWEEP] Publicados al arrancar -> Módulos: ${res.publishedModules}, Lecciones: ${res.publishedLessons}, Evaluaciones: ${res.publishedAssessments}`);
      }
    });

    // Polling periódico
    this.timer = setInterval(() => {
      this.checkAndPublishScheduledContent();
    }, intervalMs);
  }

  /**
   * Apaga limpiamente el timer.
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[SCHEDULED PUBLISH] Servicio detenido correctamente.');
    }
  }
}
