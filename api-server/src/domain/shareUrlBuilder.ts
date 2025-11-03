// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

export class ShareUrlBuilder {
  buildRelativePath(appointmentId: string): string {
    return `/appointments/${appointmentId}`;
  }
}
