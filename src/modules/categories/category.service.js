import { categoryRepository } from './category.repository';

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class CategoryService {
  async getCategories() {
    return categoryRepository.findAll();
  }

  async createCategory(name) {
    if (!name?.trim()) throw new Error('Category name is required');
    return categoryRepository.create({ name: name.trim(), slug: toSlug(name) });
  }
}

export const categoryService = new CategoryService();
