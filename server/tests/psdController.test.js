import { jest } from '@jest/globals';
import { downloadPsd } from '../controllers/psdController.js';

// Mock dependencies
jest.mock('../utils/jobStore.js');
jest.mock('../utils/googleDrive.js');
jest.mock('../utils/logger.js');

describe('PSD Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {
        jobId: 'test-job-123',
        imageIndex: '0'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Parameter Validation', () => {
    test('should return 400 if jobId is missing', async () => {
      req.params.jobId = null;

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Missing required parameters'
        })
      );
    });

    test('should return 400 if imageIndex is invalid', async () => {
      req.params.imageIndex = 'invalid';

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid image index'
        })
      );
    });

    test('should return 400 if imageIndex is negative', async () => {
      req.params.imageIndex = '-1';

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid image index'
        })
      );
    });
  });

  describe('Job Validation', () => {
    test('should return 404 if job not found', async () => {
      const { getJobWithFallback } = await import('../utils/jobStore.js');
      getJobWithFallback.mockResolvedValue(null);

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Job not found'
        })
      );
    });

    test('should return 404 if job has no edited images', async () => {
      const { getJobWithFallback } = await import('../utils/jobStore.js');
      getJobWithFallback.mockResolvedValue({
        id: 'test-job-123',
        editedImages: []
      });

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No edited images found'
        })
      );
    });

    test('should return 400 if imageIndex out of range', async () => {
      const { getJobWithFallback } = await import('../utils/jobStore.js');
      getJobWithFallback.mockResolvedValue({
        id: 'test-job-123',
        editedImages: [{ id: 'img1' }]
      });

      req.params.imageIndex = '5';

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid image index'
        })
      );
    });
  });

  describe('Image Data Validation', () => {
    test('should return 500 if image IDs are missing', async () => {
      const { getJobWithFallback } = await import('../utils/jobStore.js');
      getJobWithFallback.mockResolvedValue({
        id: 'test-job-123',
        editedImages: [{
          originalName: 'test.jpg'
          // Missing originalImageId and editedImageId
        }]
      });

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid job data'
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle Google Drive download errors gracefully', async () => {
      const { getJobWithFallback } = await import('../utils/jobStore.js');
      const { downloadFileFromDrive } = await import('../utils/googleDrive.js');

      getJobWithFallback.mockResolvedValue({
        id: 'test-job-123',
        editedImages: [{
          originalImageId: 'orig-123',
          editedImageId: 'edit-123',
          originalName: 'test.jpg'
        }]
      });

      downloadFileFromDrive.mockRejectedValue(new Error('credentials expired'));

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to download images from Google Drive'
        })
      );
    });

    test('should handle buffer validation errors', async () => {
      const { getJobWithFallback } = await import('../utils/jobStore.js');
      const { downloadFileFromDrive } = await import('../utils/googleDrive.js');

      getJobWithFallback.mockResolvedValue({
        id: 'test-job-123',
        editedImages: [{
          originalImageId: 'orig-123',
          editedImageId: 'edit-123',
          originalName: 'test.jpg'
        }]
      });

      downloadFileFromDrive.mockResolvedValue(null); // Invalid buffer

      await downloadPsd(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid image data'
        })
      );
    });
  });
});
