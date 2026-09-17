import React from 'react';
import { useAuth } from '../auth/useAuth.js';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'TEACHER':
        return 'Maestro';
      case 'STUDENT':
        return 'Alumno';
      default:
        return role || '';
    }
  };

  const renderRoleCards = () => {
    if (!user) return null;

    switch (user.role) {
      case 'ADMIN':
        return (
          <div className="dashboard-grid">
            <div className="dashboard-card" id="card-admin-teachers">
              <h3 className="dashboard-card-title">Gestión de Maestros</h3>
              <p className="dashboard-card-desc">
                Alta de docentes, envío de invitaciones iniciales y asignación de materias.
              </p>
            </div>
            <div className="dashboard-card" id="card-admin-courses">
              <h3 className="dashboard-card-title">Gestión de Cursos</h3>
              <p className="dashboard-card-desc">
                Creación de ofertas académicas, configuración de materias e inscripciones.
              </p>
            </div>
            <div className="dashboard-card" id="card-admin-system">
              <h3 className="dashboard-card-title">Administración del Sistema</h3>
              <p className="dashboard-card-desc">
                Monitoreo del estado de conectividad, base de datos y parámetros globales.
              </p>
            </div>
          </div>
        );

      case 'TEACHER':
        return (
          <div className="dashboard-grid">
            <div className="dashboard-card" id="card-teacher-courses">
              <h3 className="dashboard-card-title">Mis Cursos Impartidos</h3>
              <p className="dashboard-card-desc">
                Acceso a los cursos asignados, gestión de módulos, lecciones y materiales.
              </p>
            </div>
            <div className="dashboard-card" id="card-teacher-students">
              <h3 className="dashboard-card-title">Gestión de Alumnos</h3>
              <p className="dashboard-card-desc">
                Inscripción manual de alumnos a tus cursos y reenvío de invitaciones de acceso.
              </p>
            </div>
            <div className="dashboard-card" id="card-teacher-evaluations">
              <h3 className="dashboard-card-title">Evaluaciones y Calificaciones</h3>
              <p className="dashboard-card-desc">
                Revisión de ejercicios, calificaciones del grupo y rendimiento académico.
              </p>
            </div>
          </div>
        );

      case 'STUDENT':
        return (
          <div className="dashboard-grid">
            <div className="dashboard-card" id="card-student-courses">
              <h3 className="dashboard-card-title">Mis Cursos Inscritos</h3>
              <p className="dashboard-card-desc">
                Consulta los cursos en los que te encuentras inscrito para comenzar tu aprendizaje.
              </p>
            </div>
            <div className="dashboard-card" id="card-student-progress">
              <h3 className="dashboard-card-title">Mi Progreso Académico</h3>
              <p className="dashboard-card-desc">
                Sigue el avance de tus contenidos vistos, actividades realizadas y calificaciones.
              </p>
            </div>
            <div className="dashboard-card" id="card-student-tasks">
              <h3 className="dashboard-card-title">Actividades Pendientes</h3>
              <p className="dashboard-card-desc">
                Revisa evaluaciones y cuestionarios con entregas o fechas límite próximas.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <h1 className="page-title" id="dashboard-welcome-title">
        Bienvenido, {user?.name}
      </h1>
      <p className="page-description" id="dashboard-welcome-desc">
        Panel de control de PotroLearn ({getRoleLabel(user?.role)}).
      </p>

      {renderRoleCards()}
    </div>
  );
};
