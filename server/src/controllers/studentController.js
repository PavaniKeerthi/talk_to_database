import Student from '../models/Student.js';

export const getStudents = async (req, res) => {
  try {
    const students = await Student.find();

    if (students.length === 0) {
      return res.status(200).json({
        message: 'No students found.',
        students: [],
      });
    }

    res.status(200).json({
      message: 'Students retrieved successfully.',
      count: students.length,
      students: students,
    });
  } catch (error) {
    console.error('Error retrieving students:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve students from database.',
    });
  }
};
