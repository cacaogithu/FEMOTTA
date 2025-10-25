import React, { useState, useEffect } from 'react';
import { brandService } from '../services/brandService';
import './BrandSelector.css';

function BrandSelector() {
  const [brands, setBrands] = useState([]);
  const [currentBrand, setCurrentBrand] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadBrands();
  }, []);

  async function loadBrands() {
    const availableBrands = await brandService.loadAvailableBrands();
    setBrands(availableBrands);
    
    const current = await brandService.getBrand();
    setCurrentBrand(current);
  }

  function handleBrandChange(brandSlug) {
    brandService.setCurrentBrand(brandSlug);
  }

  if (brands.length <= 1) {
    return null; // Hide if only one brand
  }

  return (
    <div className="brand-selector">
      <button 
        className="brand-selector-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="brand-icon">🏢</span>
        {currentBrand?.displayName || 'Select Brand'}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {isOpen && (
        <div className="brand-dropdown">
          {brands.map(brand => (
            <button
              key={brand.id}
              className={`brand-option ${brand.slug === currentBrand?.slug ? 'active' : ''}`}
              onClick={() => handleBrandChange(brand.slug)}
            >
              {brand.logoUrl && (
                <img 
                  src={brand.logoUrl} 
                  alt={brand.displayName}
                  className="brand-logo-small"
                />
              )}
              <span>{brand.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BrandSelector;
