import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { projectsController } from './controller'
import {
	validateAcceptProject,
	validateCreateProject,
	validateInviteFreelancer,
	validateProjectTransition,
	validateUpdateProject,
} from './validation'

const router = Router()

/**
 * @openapi
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects
 *     description: Returns marketplace and dashboard project records. Clients can filter by status, owner, or freelancer to power project discovery and workspace views.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Optional project status filter.
 *       - in: query
 *         name: ownerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: freelancerId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project collection.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Project'
 *   post:
 *     tags: [Projects]
 *     summary: Create a project
 *     description: Creates a client-owned project with optional freelancer invitation and milestone plan. Validation ensures budgets and milestone amounts are positive.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, budget, ownerId]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               budget:
 *                 type: number
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               ownerId:
 *                 type: string
 *                 format: uuid
 *               invitedFreelancerId:
 *                 type: string
 *                 format: uuid
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [title, amount]
 *                   properties:
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     amount:
 *                       type: number
 *           example:
 *             title: "Decentralized escrow dashboard"
 *             description: "Build milestone tracking and escrow payment release screens."
 *             budget: 5000
 *             deadline: "2026-06-30T18:30:00.000Z"
 *             ownerId: "5b827f08-4a8b-4d1a-bf8b-e6dc3ea4e3f7"
 *             invitedFreelancerId: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *             milestones:
 *               - title: "Escrow smart contract integration"
 *                 description: "Integrate deposit and release flows."
 *                 amount: 2500
 *     responses:
 *       201:
 *         description: Project created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project by ID
 *     description: Returns a project and its milestone details for project detail screens, contract funding flows, and review workflows.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Projects]
 *     summary: Update project
 *     description: Updates editable project metadata, assignment fields, or status. Use lifecycle endpoints for business-state transitions where possible.
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
 *               budget:
 *                 type: number
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *               invitedFreelancerId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               freelancerId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *           example:
 *             title: "Escrow dashboard v2"
 *             budget: 6200
 *     responses:
 *       200:
 *         description: Project updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Projects]
 *     summary: Delete project
 *     description: Removes a project record. This is intended for cleanup/admin flows and should not be used once escrow or review history matters.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project removed.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/projects/{id}/invite:
 *   post:
 *     tags: [Projects]
 *     summary: Invite a freelancer to a project
 *     description: Moves a project into an invited state and records the freelancer selected by the client.
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
 *             required: [invitedFreelancerId]
 *             properties:
 *               invitedFreelancerId:
 *                 type: string
 *                 format: uuid
 *           example:
 *             invitedFreelancerId: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *     responses:
 *       200:
 *         description: Freelancer invited.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/projects/{id}/accept:
 *   post:
 *     tags: [Projects]
 *     summary: Accept a project invitation
 *     description: Allows the invited freelancer to accept the project and transitions the project into active work.
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
 *             required: [freelancerId]
 *             properties:
 *               freelancerId:
 *                 type: string
 *                 format: uuid
 *           example:
 *             freelancerId: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *     responses:
 *       200:
 *         description: Project accepted.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/projects/{id}/submit:
 *   post:
 *     tags: [Projects]
 *     summary: Mark project as submitted
 *     description: Moves a project from active work into client review after the freelancer has submitted deliverables.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project transitioned.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/projects/{id}/approve:
 *   post:
 *     tags: [Projects]
 *     summary: Approve project work
 *     description: Client-side lifecycle action that approves submitted work and prepares payment release/completion flows.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project approved.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/projects/{id}/reject:
 *   post:
 *     tags: [Projects]
 *     summary: Reject submitted project work
 *     description: JWT-protected client review action that rejects submitted work and moves the project back into a rejected state for revision or dispute follow-up.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Project ID to reject.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project rejected.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/projects/{id}/complete:
 *   post:
 *     tags: [Projects]
 *     summary: Complete a project
 *     description: Finalizes the project after approval and payment release are complete.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project completed.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/projects/{id}/dispute:
 *   post:
 *     tags: [Projects]
 *     summary: Open a project dispute
 *     description: Moves a project into dispute when the client and freelancer cannot resolve review or payment outcome manually.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project disputed.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/', projectsController.list)
router.get('/:id', projectsController.getById)
router.post('/', validateCreateProject, projectsController.create)
router.put('/:id', validateUpdateProject, projectsController.update)
router.post('/:id/invite', validateInviteFreelancer, projectsController.invite)
router.post('/:id/accept', validateAcceptProject, projectsController.accept)
router.post('/:id/submit', validateProjectTransition, projectsController.submit)
router.post('/:id/approve', validateProjectTransition, projectsController.approve)
router.post('/:id/reject', authenticate(), validateProjectTransition, projectsController.reject)
router.post('/:id/complete', validateProjectTransition, projectsController.complete)
router.post('/:id/dispute', validateProjectTransition, projectsController.dispute)
router.delete('/:id', projectsController.remove)

export default router
