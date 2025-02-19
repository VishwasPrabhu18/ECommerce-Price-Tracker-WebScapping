import { connectToDatabase } from "@/lib/mongoose";
import { generateEmailBody, sendEmail } from "@/lib/nodemailer";
import { scrapeAmazonProduct } from "@/lib/scraper";
import { getAveragePrice, getEmailNotifType, getHighestPrice, getLowestPrice } from "@/lib/utils";
import Product from "@/models/product.model";
import { NextResponse } from "next/server";

export const maxDuration = 5; // 5 minutes
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    connectToDatabase();

    const products = await Product.find({});

    if (!products) throw new Error("No products found");
    
    // 1. Scrape lateest product details and update the database
    const updatedProducts = await Promise.all(
      products.map(async (currentProduct) => {
        const scrapedProduct = await scrapeAmazonProduct(currentProduct.url);
        if (!scrapedProduct) throw new Error("No product found");
        
        const updatedPriceHistory:any = [
          ...currentProduct.priceHistory,
          {
            price: scrapedProduct.currentPrice,
          },
        ];

        const product = {
          ...scrapedProduct,
          priceHistory: updatedPriceHistory,
          lowestPrice: getLowestPrice(updatedPriceHistory),
          highestPrice: getHighestPrice(updatedPriceHistory),
          averagePrice: getAveragePrice(updatedPriceHistory),
        };

        // Update Products in DB
        const updatedProduct = await Product.findOneAndUpdate(
          {
            url: product.url,
          },
          product
        );

        // 2. Check each products status and send email if needed
        const emailNotifType = getEmailNotifType(scrapedProduct, currentProduct);
        if(emailNotifType && updatedProduct.users.length > 0) {
          const productInfo = {
            title: updatedProduct.title,
            url: updatedProduct.url,
          }

          const emailContent = await generateEmailBody(productInfo, emailNotifType);

          const userEmails = updatedProduct.users.map((user: any) => user.email);
          
          await sendEmail(emailContent, userEmails);
        }

        return updatedProduct;
      }));
    
    return NextResponse.json({
      message: "OK",
      data: updatedProducts,
    });
  } catch (error) {
    throw new Error(`Error in GET: ${error}`);
  }
}