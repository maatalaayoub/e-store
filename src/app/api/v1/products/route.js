import { NextResponse } from 'next/server';
import { productService } from '@/modules/products/product.service';
import { productSchema } from '@/modules/products/product.validation';

export async function GET(req) {
  try {
    const products = await productService.getProducts();
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const validatedData = productSchema.parse(body);
    
    // In a real scenario, use Supabase JWT auth middleware to check admin role here
    const newProduct = await productService.createProduct(validatedData);
    
    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Error' },
      { status: 500 }
    );
  }
}
