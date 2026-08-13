import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    credits: {
      type: Number,
      required: true,
    },
    instructor: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Course = mongoose.model('Course', courseSchema, 'courses');

export default Course;
