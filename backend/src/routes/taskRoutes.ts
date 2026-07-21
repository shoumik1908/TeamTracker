import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createTask, getTasks, getTask, updateTask, deleteTask } from '../controllers/taskController';

const router = Router();

router.use(authenticateToken);
router.get('/', getTasks);
router.post('/', createTask);
router.get('/:id', getTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
