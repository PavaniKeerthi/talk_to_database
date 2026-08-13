import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Student from '../src/models/Student.js';
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

const insertSampleData = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB.');

    // Clear existing students collection
    await Student.deleteMany({});
    console.log('Cleared existing students collection.');

    // Insert sample data
    const result = await Student.insertMany(sampleStudents);
    console.log(`Successfully inserted ${result.length} sample students.`);

    // Display inserted students
    console.log('\nInserted students:');
    result.forEach((student, index) => {
      console.log(
        `${index + 1}. ${student.name} (${student.branch}, CGPA: ${student.cgpa}, Year: ${student.year})`
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
