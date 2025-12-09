import { Router } from 'express';
import {
  getAllUsers,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/usersController.js';

const router = Router();

router.get('/', getAllUsers);
router.get('/:username', getUserByUsername);
router.post('/', createUser);
router.put('/:username', updateUser);
router.patch('/:username', updateUser);
router.delete('/:username', deleteUser);

export default router;

