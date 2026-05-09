import dns from "node:dns";
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is missing in environment variables");
    }

    if (mongoUri.startsWith("mongodb+srv://")) {
      dns.setDefaultResultOrder("ipv4first");
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    }

    const connection = await mongoose.connect(mongoUri);

    console.log(`MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
