import { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot } from '../firebase';
import { Product } from '../types';
import { Package, Phone, Search, X } from 'lucide-react';
import { Logo } from './Logo';
import { HeartZap } from './HeartZap';
import { cn } from '../lib/utils';

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch featured products
    const q = query(collection(db, 'products'), where('isFeatured', '==', true));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching featured products:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOrder = (product: Product) => {
    // Format a WhatsApp message
    const message = `Hi! I'm interested in ordering: ${product.name} (৳${product.price}). Is it available?`;
    const encodedMessage = encodeURIComponent(message);
    // Replace with actual shop phone number if available, or just open generic wa.me
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm">
              <Logo className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">StockPilot Shop</span>
          </div>
          <a href="/" className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            Owner Login
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-indigo-600 text-white py-8 sm:py-12 px-4 text-center">
        <h1 className="text-2xl sm:text-4xl font-black mb-2">Welcome to Our Store</h1>
        <p className="text-indigo-100 text-base max-w-2xl mx-auto opacity-90 font-medium">
          Browse our featured products and order directly via WhatsApp. Fast, simple, and secure.
        </p>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 -mt-8">
        
        {/* Search Bar */}
        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2 mb-6 max-w-lg mx-auto">
          <div className="pl-3 text-slate-400 dark:text-slate-500">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search our catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 py-2 pr-3 bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
              <div 
                className="aspect-square bg-slate-100 dark:bg-slate-800 relative overflow-hidden cursor-pointer"
                onClick={() => product.imageUrl && setLightboxImage(product.imageUrl)}
              >
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                    <Package size={48} strokeWidth={1} />
                  </div>
                )}
                {product.stock <= 0 && (
                  <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                    <span className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold px-4 py-2 rounded-full text-sm uppercase tracking-wider">
                      Out of Stock
                    </span>
                  </div>
                )}
              </div>
              
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-3 mb-1.5">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{product.category}</p>
                  </div>
                  <span className="font-black text-lg text-indigo-600 dark:text-indigo-400 shrink-0">৳{product.price}</span>
                </div>
                
                {product.description && (
                  <p className="text-slate-600 dark:text-slate-400 text-xs mt-2 line-clamp-2 flex-1">
                    {product.description}
                  </p>
                )}

                <button
                  onClick={() => handleOrder(product)}
                  disabled={product.stock <= 0}
                  className="mt-4 w-full py-2.5 bg-slate-900 dark:bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Phone size={16} />
                  Order via WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <Package className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No products found</h3>
            <p className="text-slate-500 dark:text-slate-400">
              {searchQuery ? `We couldn't find anything matching "${searchQuery}".` : "Check back later for new featured products!"}
            </p>
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            <X size={24} />
          </button>
          <img 
            src={lightboxImage} 
            alt="Product" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-8 text-center">
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">© {new Date().getFullYear()} StockPilot Shop. All rights reserved.</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
          Made with <HeartZap className="w-4 h-4" /> by <span className="font-bold text-slate-700 dark:text-slate-300">Abu Hanif</span>
        </p>
      </footer>
    </div>
  );
}
