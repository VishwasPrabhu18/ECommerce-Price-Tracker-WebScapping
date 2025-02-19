"use server";

import { revalidatePath } from "next/cache";
import Product from "@/models/product.model";
import { connectToDatabase } from "../mongoose";
import { scrapeAmazonProduct } from "../scraper";
import { getAveragePrice, getHighestPrice, getLowestPrice } from "../utils";
import { User } from "@/types";
import { generateEmailBody, sendEmail } from "../nodemailer";

export async function sracpeAndStoreProduct(productUrl: string) {
  if (!productUrl) return;

  try {
    connectToDatabase();

    const scrapedProduct = await scrapeAmazonProduct(productUrl);

    if (!scrapedProduct) return;

    let product = scrapedProduct;

    const existingProduct = await Product.findOne({ url: scrapedProduct.url });

    if (existingProduct) {
      const updatedPriceHistory: any = [
        ...existingProduct.priceHistory,
        {
          price: scrapedProduct.currentPrice,
        },
      ];

      product = {
        ...scrapedProduct,
        priceHistory: updatedPriceHistory,
        lowestPrice: getLowestPrice(updatedPriceHistory),
        highestPrice: getHighestPrice(updatedPriceHistory),
        averagePrice: getAveragePrice(updatedPriceHistory),
      }
    }

    const newProduct = await Product.findOneAndUpdate({
      url: scrapedProduct.url,
    }, product, { new: true, upsert: true }
    );

    revalidatePath(`/product/${newProduct._id}`);

  } catch (error: any) {
    throw new Error(`Failed to create/update product: ${error.message}`);
  }
};

export async function getProductById(productId: string) {
  if (!productId) return;

  try {
    connectToDatabase();

    const product = await Product.findOne({ _id: productId });

    if (!product) return;
    
    return product;
  } catch (error: any) {
    throw new Error(`Failed to fetch product: ${error.message}`)
  }
};

export async function getAllProducts() { 
  try {
    connectToDatabase();

    const products = await Product.find();

    return products;
  } catch (error: any) {
    throw new Error(`Failed to fetch products: ${error.message}`)
  }
};

export async function getSimilarProducts(productId: string) { 
  try {
    connectToDatabase();

    const currentProduct = await Product.findById(productId);

    if (!currentProduct) return null;

    const similarProduct = await Product.find({
      _id: { $ne: productId },
    }).limit(4);

    return similarProduct;
  } catch (error: any) {
    throw new Error(`Failed to fetch products: ${error.message}`)
  }
};

export async function addUserEmailToProduct(productId: string, userEmail: string) {
  if (!productId || !userEmail) return;

  try {
    const product = await Product.findById(productId);

    if (!product) return;

    const userExists = product.users.some((user: User) => user.email === userEmail);

    if (!userExists) { 
      product.users.push({ email: userEmail });

      await product.save();

      const emailContent = await generateEmailBody(product, "WELCOME");

      await sendEmail(emailContent, [userEmail]);
    }

  } catch (error: any) {
    console.log(`Failed to add user email to product: ${error.message}`); 
  }
};