import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { createSecureUploadMiddleware } from '../../middleware/upload.middleware'
import { submissionsController } from './controller'
import { validateCreateSubmission, validateUpdateSubmission, validateUploadSubmission } from './validation'

const router = Router()

const uploadSingle = createSecureUploadMiddleware()

/**
 * @openapi
 * /api/submissions:
 *   get:
 *     tags: [Submissions]
 *     summary: List submissions
 *     description: Returns milestone submission records, optionally filtered by milestone or submitter. Intended for project review screens and audit trails.
 *     parameters:
 *       - in: query
 *         name: milestoneId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: submittedById
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Submission collection.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Submission'
 *   post:
 *     tags: [Submissions]
 *     summary: Create a submission with external links
 *     description: Creates a non-file submission using repository/demo links and marks the related milestone as submitted.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [milestoneId, submittedById]
 *             properties:
 *               milestoneId:
 *                 type: string
 *                 format: uuid
 *               submittedById:
 *                 type: string
 *                 format: uuid
 *               githubLink:
 *                 type: string
 *                 format: uri
 *               demoLink:
 *                 type: string
 *                 format: uri
 *               remarks:
 *                 type: string
 *           example:
 *             milestoneId: "96842c43-665c-46fe-9b27-751f1c4df8f0"
 *             submittedById: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *             githubLink: "https://github.com/acme/proofchain-ui"
 *             demoLink: "https://demo.proofchain.dev"
 *             remarks: "Milestone is ready for review."
 *     responses:
 *       201:
 *         description: Submission created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Submission'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/submissions/upload:
 *   post:
 *     tags: [Submissions]
 *     summary: Upload deliverable file for a submission
 *     description: Authenticated upload endpoint for freelancer deliverables. Accepts PDF, PNG, JPG/JPEG, or ZIP files up to 20MB, pins the file to the configured IPFS provider, creates a submission record, and marks the milestone as submitted.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, milestoneId, submittedById]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF, PNG, JPG/JPEG, or ZIP file. Maximum size is 20MB.
 *               milestoneId:
 *                 type: string
 *                 format: uuid
 *               submittedById:
 *                 type: string
 *                 format: uuid
 *               remarks:
 *                 type: string
 *                 example: "Final deliverable attached for client review."
 *           encoding:
 *             file:
 *               contentType: application/pdf
 *           examples:
 *             pdfDeliverable:
 *               summary: Upload a PDF deliverable
 *               value:
 *                 file: "(binary PDF file)"
 *                 milestoneId: "96842c43-665c-46fe-9b27-751f1c4df8f0"
 *                 submittedById: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *                 remarks: "Final deliverable attached for client review."
 *             zipSourceBundle:
 *               summary: Upload a ZIP source bundle
 *               value:
 *                 file: "(binary ZIP file)"
 *                 milestoneId: "96842c43-665c-46fe-9b27-751f1c4df8f0"
 *                 submittedById: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *                 remarks: "Source code bundle and documentation."
 *     responses:
 *       201:
 *         description: File uploaded and submission created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadSubmissionResponse'
 *             examples:
 *               uploaded:
 *                 summary: Uploaded deliverable response
 *                 value:
 *                   success: true
 *                   message: "Upload successful"
 *                   data:
 *                     ipfsCid: "bafybeigdyrzt5examplecid"
 *                     gatewayUrl: "https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5examplecid"
 *                     submission:
 *                       id: "4e932fdf-d57d-4c9c-93df-fb328ab0f281"
 *                       milestoneId: "96842c43-665c-46fe-9b27-751f1c4df8f0"
 *                       submittedById: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *                       remarks: "Final deliverable attached for client review."
 *                       ipfsCid: "bafybeigdyrzt5examplecid"
 *                       gatewayUrl: "https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5examplecid"
 *                       createdAt: "2026-05-22T10:30:00.000Z"
 *                       updatedAt: "2026-05-22T10:30:00.000Z"
 *       400:
 *         description: Validation failed, file field is missing, or file type is not allowed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *             examples:
 *               missingMilestone:
 *                 summary: Missing milestone ID
 *                 value:
 *                   success: false
 *                   message: "Validation failed"
 *                   code: "VALIDATION_ERROR"
 *                   errors:
 *                     - path: "body.milestoneId"
 *                       message: "Invalid milestone id"
 *               unsupportedType:
 *                 summary: Unsupported file type
 *                 value:
 *                   success: false
 *                   message: "Unsupported file type"
 *                   code: "UPLOAD_MIME_NOT_ALLOWED"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       413:
 *         description: Uploaded file is larger than the configured limit.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "File size must not exceed 20MB"
 *               code: "UPLOAD_FILE_TOO_LARGE"
 *
 * /api/submissions/{id}:
 *   get:
 *     tags: [Submissions]
 *     summary: Get submission by ID
 *     description: Returns a single submission for review, including stored IPFS metadata when the submission was uploaded as a file.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Submission details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Submission'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Submissions]
 *     summary: Update submission links or remarks
 *     description: Updates mutable submission metadata such as demo links, GitHub links, and review remarks without replacing uploaded files.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               githubLink:
 *                 type: string
 *                 format: uri
 *               demoLink:
 *                 type: string
 *                 format: uri
 *               remarks:
 *                 type: string
 *           example:
 *             demoLink: "https://updated-demo.proofchain.dev"
 *             remarks: "Updated deployment link."
 *     responses:
 *       200:
 *         description: Submission updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Submission'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Submissions]
 *     summary: Delete submission
 *     description: Removes a submission record. Use cautiously because this affects milestone review history.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Submission removed.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/', submissionsController.list)
router.get('/:id', submissionsController.getById)
router.post('/', validateCreateSubmission, submissionsController.create)
router.post('/upload', authenticate(), ...uploadSingle, validateUploadSubmission, submissionsController.upload)
router.put('/:id', validateUpdateSubmission, submissionsController.update)
router.delete('/:id', submissionsController.remove)

export default router
