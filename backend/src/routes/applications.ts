import { Router, Response, NextFunction } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  AuthenticatedRequest,
  ApiResponse,
  ApplicationRow,
  Application,
  CreateApplicationRequest,
  UpdateApplicationRequest,
  ApplicationStats,
  ApplicationStatus,
} from '../types';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// Valid status values
const VALID_STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected'];

// Helper to validate status
function isValidStatus(status: string): status is ApplicationStatus {
  return VALID_STATUSES.includes(status as ApplicationStatus);
}

// GET /api/applications — get all applications for logged-in user
router.get('/', async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse<Application[]>>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const result = await pool.query<ApplicationRow>(
      `SELECT id, user_id, company, role, status, job_url, date_applied, 
              interview_date, notes, created_at, updated_at
       FROM applications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'Applications retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/applications — create a new application
router.post('/', async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse<Application>>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { company, role, status, job_url, date_applied, interview_date, notes } = req.body as CreateApplicationRequest;

    // Validate required fields
    if (!company || !role) {
      res.status(400).json({
        success: false,
        message: 'Company and role are required',
      });
      return;
    }

    // Validate status if provided
    if (status && !isValidStatus(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    const result = await pool.query<ApplicationRow>(
      `INSERT INTO applications (user_id, company, role, status, job_url, date_applied, interview_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, company, role, status, job_url, date_applied, interview_date, notes, created_at, updated_at`,
      [
        userId,
        company,
        role,
        status || 'saved',
        job_url || null,
        date_applied || null,
        interview_date || null,
        notes || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Application created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/applications/:id — update an application
router.put('/:id', async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse<Application>>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const updates = req.body as UpdateApplicationRequest;

    // Build dynamic update query
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const allowedFields = ['company', 'role', 'status', 'job_url', 'date_applied', 'interview_date', 'notes'];

    for (const field of allowedFields) {
      if (field in updates) {
        // Validate status
        if (field === 'status' && !isValidStatus(updates[field as keyof UpdateApplicationRequest] as string)) {
          res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
          });
          return;
        }
        fields.push(`${field} = $${paramIndex}`);
        values.push(updates[field as keyof UpdateApplicationRequest]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
      return;
    }

    // Check ownership and update
    values.push(id, userId);
    const result = await pool.query<ApplicationRow>(
      `UPDATE applications
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING id, user_id, company, role, status, job_url, date_applied, interview_date, notes, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Application not found or you do not have permission to update it',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Application updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/applications/:id — delete an application
router.delete('/:id', async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM applications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Application not found or you do not have permission to delete it',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Application deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/applications/stats — get stats for logged-in user
router.get('/stats', async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse<ApplicationStats>>,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Get total count
    const totalResult = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM applications WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    // Get counts per status
    const statusResult = await pool.query<{ status: ApplicationStatus; count: string }>(
      `SELECT status, COUNT(*) as count
       FROM applications
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );

    // Build by_status object
    const byStatus: Record<ApplicationStatus, number> = {
      saved: 0,
      applied: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
    };

    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    // Calculate response rate: interviews / total applied * 100
    const appliedCount = byStatus.applied + byStatus.interview + byStatus.offer + byStatus.rejected;
    const interviewCount = byStatus.interview + byStatus.offer;
    const responseRate = appliedCount > 0 ? Math.round((interviewCount / appliedCount) * 100 * 100) / 100 : 0;

    res.status(200).json({
      success: true,
      message: 'Stats retrieved successfully',
      data: {
        total,
        by_status: byStatus,
        response_rate: responseRate,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;