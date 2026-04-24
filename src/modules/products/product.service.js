import { productRepository } from './product.repository';

export class ProductService {
  async getProducts() {
    return productRepository.findAll();
  }

  async getProductById(id) {
    if (!id) throw new Error('Product ID required');
    return productRepository.findById(id);
  }

  async createProduct(data) {
    // validation could happen here optionally or via controller layer
    return productRepository.create(data);
  }
}

export const productService = new ProductService();