/* Deliberately cannot submit. Replace this boundary with a reviewed API later. */
export const submissionAdapter = Object.freeze({
  mode: 'preview-only',
  async preview(application) {
    return {application, sent: false, persisted: false, status: 'draft-preview'};
  }
});
