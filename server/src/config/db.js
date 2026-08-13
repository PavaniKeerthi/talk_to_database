import mongoose from 'mongoose';

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    throw new Error('MONGO_URI environment variable is not defined. Please add it to your .env file.');
  }

  try {
    await mongoose.connect(mongoURI, {
      dbName: 'talkdb',
    });
    console.log('MongoDB connected to talkdb database.');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
};

export default connectDB;
