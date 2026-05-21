import { Router } from 'express'
import { milestonesController } from './controller'
import { validateCreateMilestone, validateUpdateMilestone } from './validation'

const router = Router()

/**
 * @openapi
 * /api/milestones:
 *   get:
 *     tags: [Milestones]
 *     summary: List milestones
 *     description: Returns milestone records used to track scoped deliverables, due work, review state, and payment slices across projects.
 *     responses:
 *       200:
 *         description: Milestone collection.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Milestone'
 *   post:
 *     tags: [Milestones]
 *     summary: Create a milestone
 *     description: Adds a billable milestone to a project. Amount must be positive because milestones drive escrow allocation and payment release.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, title, amount]
 *             properties:
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               title:
 *                 type: string
 *                 minLength: 3
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 exclusiveMinimum: true
 *           example:
 *             projectId: "17696acb-df61-41f0-a08d-6f024bf9acda"
 *             title: "Escrow smart contract integration"
 *             description: "Integrate deposit and release flows."
 *             amount: 1250
 *     responses:
 *       201:
 *         description: Milestone created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Milestone'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/milestones/{id}:
 *   get:
 *     tags: [Milestones]
 *     summary: Get milestone by ID
 *     description: Returns milestone details for submission, review, and payment status views.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Milestone details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Milestone'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Milestones]
 *     summary: Update milestone
 *     description: Updates milestone scope, amount, or workflow status as project work progresses through submission and review.
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, submitted, approved, rejected, completed, disputed]
 *           example:
 *             status: "submitted"
 *             description: "Deliverables uploaded for review."
 *     responses:
 *       200:
 *         description: Milestone updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Milestone'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Milestones]
 *     summary: Delete milestone
 *     description: Removes a milestone from a project. This should be limited to setup/cleanup flows before dependent submissions or payments exist.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Milestone removed.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/', milestonesController.list)
router.get('/:id', milestonesController.getById)
router.post('/', validateCreateMilestone, milestonesController.create)
router.put('/:id', validateUpdateMilestone, milestonesController.update)
router.delete('/:id', milestonesController.remove)

export default router
