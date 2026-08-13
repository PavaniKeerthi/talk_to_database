import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Student from '../src/models/Student.js';
import Course from '../src/models/Course.js';
import connectDB from '../src/config/db.js';

dotenv.config();

const sampleStudents = [
  { name: 'Aarav Kumar', branch: 'Computer Science', cgpa: 9.2, year: 4 },
  { name: 'Priya Sharma', branch: 'Electronics', cgpa: 8.8, year: 3 },
  { name: 'Rohan Patel', branch: 'Mechanical', cgpa: 7.9, year: 4 },
  { name: 'Divya Singh', branch: 'Computer Science', cgpa: 9.5, year: 2 },
  { name: 'Arjun Verma', branch: 'Civil', cgpa: 7.5, year: 3 },
  { name: 'Ananya Gupta', branch: 'Electronics', cgpa: 8.6, year: 4 },
  { name: 'Karan Nair', branch: 'Computer Science', cgpa: 8.9, year: 3 },
  { name: 'Sneha Roy', branch: 'Electrical', cgpa: 8.3, year: 2 },
  { name: 'Nikhil Desai', branch: 'Mechanical', cgpa: 8.1, year: 4 },
  { name: 'Zara Khan', branch: 'Computer Science', cgpa: 9.0, year: 2 },
];

const sampleCourses = [
  { code: 'CS101', title: 'Data Structures', credits: 3, instructor: 'Dr. Sharma' },
  { code: 'CS201', title: 'Algorithms', credits: 4, instructor: 'Prof. Patel' },
  { code: 'CS301', title: 'Database Systems', credits: 3, instructor: 'Dr. Singh' },
  { code: 'EC101', title: 'Circuit Analysis', credits: 3, instructor: 'Prof. Kumar' },
  { code: 'EC201', title: 'Digital Electronics', credits: 4, instructor: 'Dr. Verma' },
];

const insertSampleData = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // Clear existing collections
    await Student.deleteMany({});
    console.log('Cleared existing students collection.');

    await Course.deleteMany({});
    console.log('Cleared existing courses collection.');

    // Insert students
    const students = await Student.insertMany(sampleStudents);
    console.log(`Successfully inserted ${students.length} sample students.`);

    console.log('\nInserted students:');
    students.forEach((student, index) => {
      console.log(
        `${index + 1}. ${student.name} (${student.branch}, CGPA: ${student.cgpa}, Year: ${student.year})`
      );
    });

    // Insert courses
    const courses = await Course.insertMany(sampleCourses);
    console.log(`\nSuccessfully inserted ${courses.length} sample courses.`);

    console.log('\nInserted courses:');
    courses.forEach((course, index) => {
      console.log(
        `${index + 1}. ${course.code} - ${course.title} (${course.credits} credits, Instructor: ${course.instructor})`
      );
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  } catch (error) {
    console.error('Error inserting sample data:', error.message);
    process.exit(1);
  }
};

insertSampleData();
