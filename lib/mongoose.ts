import mongoose from "mongoose";

let isConnected = false;

export const connectToDatabase = async () => { 
  mongoose.set("strictQuery", true);

  if(!process.env.MONGODB_URI) return console.log("MONGODB_URI not found");
  
  if (isConnected) return console.log("Already connected to database");
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log("Connected to database");
  } catch (error: any) {
    console.log("Error connecting to database: ", error.message);    
  }
};