// Brand service for managing brand context in the frontend
class BrandService {
  constructor() {
    this.currentBrand = null;
    this.availableBrands = [];
  }

  // Get current brand from localStorage or default to corsair
  getCurrentBrandSlug() {
    return localStorage.getItem('selectedBrand') || 'corsair';
  }

  // Set current brand
  setCurrentBrand(brandSlug) {
    localStorage.setItem('selectedBrand', brandSlug);
    this.currentBrand = null; // Force reload
    window.location.reload(); // Reload to apply new branding
  }

  // Load brand configuration from API
  async loadBrandConfig() {
    try {
      const brandSlug = this.getCurrentBrandSlug();
      const response = await fetch(`/api/brand/config?brand=${brandSlug}`);
      
      if (!response.ok) {
        throw new Error('Failed to load brand config');
      }
      
      this.currentBrand = await response.json();
      return this.currentBrand;
    } catch (error) {
      console.error('Error loading brand config:', error);
      // Fallback to Corsair defaults
      this.currentBrand = {
        id: 1,
        name: 'corsair',
        displayName: 'CORSAIR',
        slug: 'corsair',
        logoUrl: '/attached_assets/image_1760917218883.png',
        primaryColor: '#FFC107',
        secondaryColor: '#FF6F00',
        aiSettings: { batchSize: 15 }
      };
      return this.currentBrand;
    }
  }

  // Load list of available brands
  async loadAvailableBrands() {
    try {
      const response = await fetch('/api/brand/list');
      if (response.ok) {
        this.availableBrands = await response.json();
      }
      return this.availableBrands;
    } catch (error) {
      console.error('Error loading brands:', error);
      return [];
    }
  }

  // Get current brand (load if not cached)
  async getBrand() {
    if (!this.currentBrand) {
      await this.loadBrandConfig();
    }
    return this.currentBrand;
  }

  // Apply brand theming to document
  applyBrandTheming(brand) {
    // Set CSS custom properties for theming
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', brand.primaryColor || '#FFC107');
    root.style.setProperty('--brand-secondary', brand.secondaryColor || '#FF6F00');
    
    // Update page title
    document.title = `${brand.displayName} AI Image Editor`;
  }
}

export const brandService = new BrandService();
