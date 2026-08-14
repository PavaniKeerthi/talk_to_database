import Course from '../models/Course.js';

export const getCourses = async (req, res) => {
  try {
    const courses = await Course.find();

    if (courses.length === 0) {
      return res.status(200).json({
        message: 'No courses found.',
        courses: [],
      });
    }

    res.status(200).json({
      message: 'Courses retrieved successfully.',
      count: courses.length,
      courses: courses,
    });
  } catch (error) {
    console.error('Error retrieving courses:', error.message);
    res.status(500).json({
      error: 'Failed to retrieve courses from database.',
    });
  }
};
