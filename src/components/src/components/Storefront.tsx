import { useState, useEffect, useRef } from 'react';
import { db, collection, query, where, onSnapshot, limit } from '../firebase';
import { Product } from '../types';
import { 
  Package, 
  Phone, 
  Search, 
  X, 
  ShoppingBag, 
  ShoppingCart,
  ArrowRight, 
  Zap, 
  ShieldCheck, 
  Globe, 
  Cpu, 
  Info, 
  ListChecks, 
  Settings as SettingsIcon,
  ChevronRight,
  ExternalLink,
  Menu,
  Gift,
  Monitor,
  User,
  AlignHorizontalSpaceAround,
  MapPin,
  Laptop,
  MessageSquareWarning,
  Wrench,
  WrenchIcon
} from 'lucide-react';
import { Logo } from './Logo';
import { HeartZap } from './HeartZap';
import { cn } from '../lib/utils';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, AnimatePresence } from 'motion/react';

gsap.registerPlugin(ScrollTrigger);

interface StorefrontProps {
  user?: any;
}

export default function Storefront({ user }: StorefrontProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const handleDemo = (feature: string) => {
    alert(`Demo Feature: "${feature}" is coming soon!`);
  };

  const handleAddToCart = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCartItems(prev => [...prev, product]);
    alert(`${product.name} added to cart!`);
  };
  
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const hasNewArrivals = products.some(p => {
    if (!p.updatedAt) return false;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return p.updatedAt.toMillis() > oneDayAgo;
  });

  useEffect(() => {
    const q = query(collection(db, 'products'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      // Sort: Featured first, then by updatedAt
      const sortedProducts = productsData.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0);
      });
      setProducts(sortedProducts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && products.length > 0) {
      // Hero animations
      const ctx = gsap.context(() => {
        gsap.from(".hero-title", {
          y: 50,
          opacity: 0,
          duration: 1,
          ease: "power4.out",
          delay: 0.2
        });
        
        gsap.from(".hero-subtitle", {
          y: 30,
          opacity: 0,
          duration: 1,
          ease: "power4.out",
          delay: 0.4
        });

        gsap.from(".hero-badge", {
          scale: 0.8,
          opacity: 0,
          duration: 0.8,
          ease: "back.out(1.7)",
          delay: 0.1
        });

        // Staggered product cards
        gsap.from(".product-card", {
          y: 60,
          opacity: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".product-grid",
            start: "top 85%",
          }
        });
      });

      return () => ctx.revert();
    }
  }, [loading, products.length]);

  useEffect(() => {
    if (!loading) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % 4);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [loading]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOrder = (product: Product) => {
    const message = `Hi! I'm interested in ordering: ${product.name} (৳${product.price}). Is it available?`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center relative overflow-hidden">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-[#ef4a23] rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f4f8] flex flex-col transition-colors duration-200 selection:bg-[#ef4a23] selection:text-white">
      {/* Stock Arrival Banner */}
      {hasNewArrivals && (
        <div className="bg-[#ef4a23] py-2 px-4 relative z-[60] overflow-hidden">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="flex items-center gap-12 whitespace-nowrap"
          >
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 text-white text-[10px] font-bold tracking-wider">
                <Zap size={12} className="fill-white" />
                Latest Products Arrived
                <span className="opacity-50">|</span>
                Check Out New Gear
              </div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Header - Star Tech Theme */}
      <header ref={headerRef} className="bg-[#081621] sticky top-0 z-50 transition-all duration-300 shadow-md">
        {/* Top Info Bar (Desktop) */}
        <div className="hidden md:flex border-b border-white/10 text-white/80 py-1.5 px-4 max-w-7xl mx-auto items-center justify-between text-xs">
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-white transition-colors" onClick={() => handleDemo('Call Center')}>Customer Care: +8801766407313</span>
            <span className="cursor-pointer hover:text-white transition-colors" onClick={() => handleDemo('Mobile Fixer')}>Mobile Fixer: +8801854648690</span>
            <span className="cursor-pointer hover:text-white transition-colors" onClick={() => handleDemo('Email Support')}>Support: support@sdccumilla.com</span>
          </div>
          <div className="flex gap-4">
            <button onClick={() => handleDemo('Track Order')} className="hover:text-white transition-colors">Track Order</button>
            <button onClick={() => handleDemo('Store Locator')} className="hover:text-white transition-colors">Store Locator</button>
          </div>
        </div>

        {/* Main Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          
          {/* Mobile Menu Icon */}
          <div className="sm:hidden flex items-center text-white">
            <button className="p-1" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
          </div>

          <div className="flex items-center gap-3 cursor-pointer sm:shrink-0 mx-auto sm:mx-0" onClick={() => window.location.hash = '#/'}>
            <div className="text-[#ef4a23] p-1 bg-white rounded flex items-center justify-center">
              <Logo className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-3xl font-[900] text-white tracking-[-0.05em] leading-none mb-1">
                SDC<span className="text-[#ef4a23]">.</span>
              </span>
              <div className="flex overflow-hidden">
                {"SMART DIGITAL CARE".split("").map((char, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ 
                      duration: 0.1, 
                      delay: index * 0.05,
                      repeat: Infinity,
                      repeatType: "reverse",
                      repeatDelay: 8
                    }}
                    className="text-[9px] font-mono text-white/50 tracking-widest uppercase whitespace-pre h-3"
                  >
                    {char}
                  </motion.span>
                ))}
              </div>
            </div>
          </div>
          
          {/* Contact HUD (Desktop) */}
          <div className="hidden lg:flex items-center gap-6 border-l border-white/10 pl-6 ml-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-[#ef4a23] uppercase tracking-tighter mb-1">Customer Care</span>
              <span className="text-white font-mono text-xs font-bold leading-none">+8801766407313</span>
            </div>
            <div className="flex flex-col border-l border-white/10 pl-6">
              <span className="text-[10px] font-mono text-[#ef4a23] uppercase tracking-tighter mb-1">Mobile Fixer</span>
              <span className="text-white font-mono text-xs font-bold leading-none">+8801854648690</span>
            </div>
          </div>
          
          {/* Search Bar - Center (Desktop) */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleDemo(`Search for: ${searchQuery}`);
            }}
            className="hidden sm:flex flex-1 max-w-2xl relative group"
          >
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2.5 pl-4 pr-12 bg-white text-slate-900 text-sm font-medium rounded-md border-none outline-none focus:ring-2 focus:ring-[#ef4a23]"
            />
            <button 
              type="submit"
              className="absolute right-0 top-0 bottom-0 px-4 text-slate-500 hover:text-[#ef4a23] transition-colors rounded-r-md"
            >
              <Search size={18} />
            </button>
          </form>

          <div className="hidden md:flex items-center gap-6 text-white shrink-0">
            <a href="#/admin" className="flex items-center gap-2 hover:text-[#ef4a23] transition-colors">
              <div className="p-2.5 bg-white/10 rounded-full">
                <Cpu size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-white/70">{user ? 'Dashboard' : 'Account'}</span>
                <span className="text-sm font-bold">{user ? 'Admin Panel' : 'Staff Login'}</span>
              </div>
            </a>
          </div>

          {/* Cart / Bag Icon (Mobile & Desktop) */}
          <div className="flex items-center text-white shrink-0 relative">
            <button 
              onClick={() => handleDemo('Cart Panel')}
              className="p-1 sm:p-2.5 sm:bg-white/10 rounded-full hover:text-[#ef4a23] sm:hover:bg-white/20 transition-colors"
            >
              <ShoppingBag size={24} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-[#ef4a23] text-white text-[10px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-[#081621]">
              {cartItems.length}
            </span>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="sm:hidden px-4 pb-3">
           <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleDemo(`Search for: ${searchQuery}`);
            }}
            className="w-full relative group"
           >
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2 pl-4 pr-10 bg-white text-slate-900 text-base font-medium rounded-md border-none outline-none focus:ring-2 focus:ring-[#ef4a23]"
            />
            <button 
              type="submit" 
              className="absolute right-0 top-0 bottom-0 px-3 text-slate-800 hover:text-[#ef4a23] transition-colors rounded-r-md"
            >
              <Search size={20} />
            </button>
          </form>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative bg-[#f2f4f8] pt-4 pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          
          {/* Main Hero Banners */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Primary Rotating Banner */}
            <div 
              className="lg:col-span-2 bg-slate-900 rounded-xl overflow-hidden relative cursor-pointer shadow-sm min-h-[160px] sm:min-h-[240px] flex items-center justify-center p-0 text-center"
              onClick={() => handleDemo(`Promo Slide ${currentSlide + 1}`)}
            >
              <AnimatePresence mode="wait">
                {currentSlide === 0 && (
                  <motion.div 
                    key="slide-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 bg-gradient-to-br from-[#ef4a23] to-[#d8401e] flex items-center justify-center p-4 sm:p-6"
                  >
                    <div className="z-10 text-white w-full max-w-lg">
                      <h2 className="text-xl sm:text-3xl font-bold mb-3">আমাদের সকল আউটলেট</h2>
                      <div className="bg-white text-[#ef4a23] py-2 sm:py-3 px-4 sm:px-6 rounded-lg mb-3 inline-block shadow-[0_4px_10px_rgba(0,0,0,0.1)]">
                        <p className="text-sm sm:text-lg font-bold text-slate-700">সকাল ৯ টা থেকে সন্ধ্যা ৭ টা পর্যন্ত</p>
                        <p className="text-2xl sm:text-4xl font-extrabold mt-1">খোলা থাকবে</p>
                      </div>
                      <p className="text-[10px] sm:text-xs block">যেকোন প্রয়োজনে ডায়াল করুন <span className="font-bold">16793</span></p>
                    </div>
                  </motion.div>
                )}
                {currentSlide === 1 && (
                  <motion.div 
                    key="slide-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    <img src="https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&q=80&w=1200" alt="Tech" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 text-center">
                        <h2 className="text-white text-2xl sm:text-4xl font-bold drop-shadow-lg">Premium Laptops<br/><span className="text-[#ef4a23]">Save up to 20%</span></h2>
                    </div>
                  </motion.div>
                )}
                {currentSlide === 2 && (
                  <motion.div 
                    key="slide-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1200" alt="Gaming" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 text-center">
                         <h2 className="text-white text-2xl sm:text-4xl font-bold drop-shadow-lg">Gaming Gears<br/><span className="text-[#ef4a23]">Level Up Now</span></h2>
                    </div>
                  </motion.div>
                )}
                {currentSlide === 3 && (
                  <motion.div 
                    key="slide-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    <img src="https://images.unsplash.com/photo-1512756290469-ec264b7fbf87?auto=format&fit=crop&q=80&w=1200" alt="Components" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-6 text-center">
                         <h2 className="text-white text-2xl sm:text-4xl font-bold drop-shadow-lg">PC Builder<br/><span className="text-[#ef4a23]">Build Your Dream PC</span></h2>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Slider Dots */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-20">
                 {[0, 1, 2, 3].map((idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentSlide(idx);
                      }}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        currentSlide === idx ? "w-6 bg-[#ef4a23]" : "bg-white/50 hover:bg-white"
                      )}
                    />
                 ))}
              </div>
            </div>
            
            {/* Mobile Sidebar Banners - 2 Grid underneath on mobile, stacked on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-4 lg:col-span-1">
               <div 
                 onClick={() => handleDemo('App Download Promo')}
                 className="bg-blue-50 rounded-xl overflow-hidden cursor-pointer shadow-sm relative h-32 md:h-auto min-h-[140px]"
               >
                 <img src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&q=80&w=400" className="absolute inset-0 w-full h-full object-cover" alt="App Banner" referrerPolicy="no-referrer" />
                 <div className="absolute inset-0 bg-gradient-to-t from-red-600/90 to-transparent p-4 flex flex-col justify-end">
                    <span className="text-white font-bold text-sm leading-tight">সব কিছু অ্যাপে...</span>
                 </div>
               </div>
               <div 
                 onClick={() => handleDemo('AC Ton Calculator')}
                 className="bg-cyan-50 rounded-xl overflow-hidden cursor-pointer shadow-sm relative h-32 md:h-auto min-h-[140px]"
               >
                 <img src="https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&q=80&w=400" className="absolute inset-0 w-full h-full object-cover" alt="AC Calc Banner" referrerPolicy="no-referrer" />
                 <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 to-transparent p-4 flex flex-col justify-end">
                    <span className="text-white font-bold text-sm leading-tight">AC Ton Calculator</span>
                 </div>
               </div>
            </div>
            
          </div>

          {/* System Status Bar */}
          <div className="bg-[#081621] rounded-lg py-3 px-6 shadow-2xl border border-white/5 flex items-center gap-6 overflow-hidden mb-6">
             <div className="flex items-center gap-3 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-[pulse_1s_infinite]"></div>
                <span className="text-[10px] font-mono text-white tracking-[0.2em] uppercase">Status: OK</span>
             </div>
             <div className="h-4 w-px bg-white/10 shrink-0"></div>
             <div className="flex-1 overflow-hidden relative border-l border-white/5 pl-6">
                <div className="flex whitespace-nowrap gap-12 animate-scroll-text">
                   {[1, 2].map(i => (
                     <p key={i} className="text-white/50 text-[10px] font-mono uppercase tracking-widest flex items-center gap-6">
                       <span>SDC HUB: Cantonment Board Jame Masjid Market</span>
                       <span className="text-[#ef4a23]">/</span>
                       <span>CARE: +8801766407313</span>
                       <span className="text-[#ef4a23]">/</span>
                       <span>FIXER: +8801854648690</span>
                       <span className="text-[#ef4a23]">/</span>
                     </p>
                   ))}
                </div>
                <style>{`
                  @keyframes scroll-text {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                  .animate-scroll-text {
                    animation: scroll-text 30s linear infinite;
                  }
                `}</style>
             </div>
          </div>

          {/* Diagnostic HUD */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { title: "Laptop Finder", icon: <Laptop size={20} className="text-white" /> },
               { title: "Raise a Complain", icon: <MessageSquareWarning size={20} className="text-white" /> },
               { title: "Home Service", icon: <User size={20} className="text-white" /> },
               { title: "Servicing Center", icon: <WrenchIcon size={20} className="text-white" /> }
             ].map((action, i) => (
                <div 
                  key={i} 
                  onClick={() => handleDemo(action.title)}
                  className="bg-white group cursor-pointer border border-slate-100 p-6 rounded-2xl flex flex-col justify-between h-36 hover:border-[#ef4a23]/30 hover:shadow-xl transition-all relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-slate-300 font-bold group-hover:text-[#ef4a23] transition-colors">
                      CMD_0{i + 1}
                   </div>
                   <div className="w-10 h-10 rounded-xl bg-slate-900 group-hover:bg-[#ef4a23] flex items-center justify-center text-white transition-colors">
                      {action.icon}
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-800 text-sm tracking-tight">{action.title}</h4>
                      <div className="h-0.5 w-4 bg-[#ef4a23] mt-2 group-hover:w-full transition-all duration-500 opacity-30 group-hover:opacity-100"></div>
                   </div>
                </div>
             ))}
          </div>

        </div>
      </section>

      {/* Section: Featured Category */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-6">
           <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">Featured Category</h2>
           <p className="text-sm text-slate-600">Get Your Desired Product from Featured Category!</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
          {[
            { name: "Drone", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/drone-48x48.png" },
            { name: "Gimbal", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/gimbal-48x48.png" },
            { name: "Tablet PC", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/tablet-48x48.png" },
            { name: "TV", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/tv-48x48.png" },
            { name: "Mobile Phone", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/mobile-phone-48x48.png" },
            { name: "Accessories", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/mobile-accessories-48x48.png" },
            { name: "Portable SSD", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/portable-ssd-48x48.png" },
            { name: "WiFi Camera", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/cc-camera-48x48.png" },
            { name: "Smart Watch", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/smart-watch-48x48.png" },
            { name: "Action Camera", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/action-camera-48x48.png" },
            { name: "Earbuds", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/earbuds-48x48.png" },
            { name: "Console", icon: "https://www.startech.com.bd/image/cache/catalog/category-thumb/gaming-console-48x48.png" },
          ].map((cat, i) => (
             <div 
               key={i} 
               onClick={() => handleDemo(`Featured Category: ${cat.name}`)}
               className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:shadow-md hover:border-[#ef4a23]/30 transition-all group"
             >
                <img src={cat.icon} alt={cat.name} className="w-10 h-10 object-contain opacity-80 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-700 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full group-hover:text-[#ef4a23] transition-colors">{cat.name}</span>
             </div>
          ))}
        </div>
      </section>

      {/* Service Hub / Location Section */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 mb-8">
         <div className="grid grid-cols-1 lg:grid-cols-12 bg-[#081621] rounded-2xl overflow-hidden shadow-2xl border border-white/5">
            {/* Left: Branding/Mission */}
            <div className="lg:col-span-5 p-8 sm:p-12 flex flex-col justify-center relative overflow-hidden bg-gradient-to-br from-[#0a1a29] to-[#081621]">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#ef4a23]/10 blur-[100px] -mr-32 -mt-32"></div>
               <motion.div 
                 initial={{ opacity: 0, y: 20 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 className="relative z-10"
               >
                 <span className="text-[#ef4a23] font-mono text-[10px] uppercase tracking-[0.3em] mb-4 block">Official Service Center</span>
                 <h3 className="text-3xl sm:text-4xl font-black text-white leading-none mb-6 tracking-tighter">
                   PREMIUM CARE<br />
                   <span className="text-white/30 text-2xl sm:text-3xl">FOR YOUR DIGITAL ASSETS</span>
                 </h3>
                 <p className="text-white/50 text-sm max-w-sm mb-8 leading-relaxed">
                   Experience specialized support and advanced mobile fixing services at our dedicated Cumilla hub.
                 </p>
                 <div className="flex flex-wrap gap-4">
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded font-mono text-[10px] text-white/70">GENUINE PARTS</div>
                    <div className="px-4 py-2 bg-white/5 border border-white/10 rounded font-mono text-[10px] text-white/70">EXPERT FIXERS</div>
                 </div>
               </motion.div>
            </div>

            {/* Right: Technical Location Guide */}
            <div className="lg:col-span-7 p-8 sm:p-12 bg-white flex flex-col justify-center relative group overflow-hidden">
               <div className="absolute inset-0 bg-slate-50/50 pointer-events-none"></div>
               <div className="relative z-10 grid sm:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-2 text-[#ef4a23] mb-4">
                       <MapPin size={24} />
                       <span className="font-mono text-[10px] uppercase tracking-widest font-bold">Location Hub</span>
                    </div>
                    <div className="space-y-4">
                       <div>
                          <p className="text-2xl font-black text-slate-800 tracking-tight leading-7">
                            Cantonment Board Jame Masjid Market
                          </p>
                          <p className="text-slate-400 text-xs mt-1 font-medium">Cumilla, Bangladesh</p>
                       </div>
                       <div className="pt-4 border-t border-slate-100 italic font-serif text-[#081621]/70 leading-relaxed">
                          "ক্যান্টনমেন্ট বোর্ড জামে মসজিদ মার্কেট, কুমিল্লা"
                       </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                     <button 
                       onClick={() => window.open('https://www.google.com/maps/search/?api=1&query=Cantonment+Board+Jame+Masjid+Market+Cumilla', '_blank')}
                       className="bg-[#081621] text-white py-4 px-6 rounded-xl font-bold flex items-center justify-between group hover:bg-[#ef4a23] transition-all duration-300 shadow-lg shadow-[#081621]/10"
                     >
                        <span>Open Navigator</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                     </button>
                     <p className="text-[10px] text-slate-400 text-center font-mono">MAP DATA: 23°28'48"N 91°06'36"E</p>
                  </div>
               </div>
               {/* Decorative Blueprint Background Element */}
               <div className="absolute bottom-0 right-0 opacity-[0.03] pointer-events-none select-none">
                  <Logo className="w-64 h-64 -mb-16 -mr-16" />
               </div>
            </div>
         </div>
      </section>

      {/* Main Content */}
      <main ref={gridRef} className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12 relative z-10">
        
        <div className="text-center mb-6 mt-4">
           <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1">Featured Products</h2>
           <p className="text-sm text-slate-600">Check & Get Your Desired Product!</p>
        </div>

        {/* Product Grid - Star Tech Style */}
        <div className="product-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map(product => {
              const originalPrice = product.price * 1.1; // Simulated original price
              const saveAmount = originalPrice - product.price;
              const discountPercent = Math.round((saveAmount / originalPrice) * 100);

              return (
              <motion.div 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                key={product.id} 
                className="product-card bg-white p-3 sm:p-5 flex flex-col group relative rounded-xl border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setSelectedProduct(product)}
              >
                {/* Purple Save Badge */}
                <div className="absolute top-0 left-0 bg-[#6b2585] text-white text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 rounded-br-xl rounded-tl-xl z-20">
                   Save: {saveAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}৳ (-{discountPercent}%)
                </div>

                <div className="aspect-square relative overflow-hidden mb-4 mt-6">
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 p-2 sm:p-4" 
                      referrerPolicy="no-referrer"
                      loading="lazy" 
                    />
                  ) : (
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=f1f5f9&color=0f172a&size=512&font-size=0.33`}
                      alt={product.name}
                      className="w-full h-full object-contain p-2 sm:p-4 opacity-50 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 rounded-lg"
                      loading="lazy"
                    />
                  )}
                </div>
                
                <div className="flex-1 flex flex-col text-left">
                  <h3 className="font-semibold text-[13px] sm:text-sm leading-snug text-slate-800 hover:text-[#ef4a23] transition-colors mb-2 line-clamp-2">
                    {product.name}
                  </h3>
                  
                  <div className="mt-auto pt-2 flex items-center gap-2">
                    <span className="font-bold text-lg sm:text-xl text-[#ef4a23]">৳ {product.price.toLocaleString()}</span>
                    <span className="font-medium text-xs sm:text-sm text-slate-400 line-through">৳{originalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

              </motion.div>
            )})}
          </AnimatePresence>
        </div>

        {filteredProducts.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-32"
          >
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 group hover:bg-[#ef4a23]/10 transition-colors">
              <Package className="h-10 w-10 text-slate-300 group-hover:text-[#ef4a23] transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No products found</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
              {searchQuery ? `We couldn't find anything matching "${searchQuery}". Try another search term.` : "Check back later for our next drop of premium electronics!"}
            </p>
          </motion.div>
        )}
      </main>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 inset-y-4 sm:inset-auto sm:w-full sm:max-w-5xl sm:h-[85vh] bg-white z-[110] rounded border border-slate-200 shadow-2xl overflow-hidden flex flex-col sm:flex-row"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-[#ef4a23] hover:text-white transition-all duration-300 shadow"
              >
                <X size={20} />
              </button>

              {/* Left: Image Section */}
              <div className="w-full sm:w-1/2 h-64 sm:h-auto bg-white relative group overflow-hidden flex items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-200">
                {selectedProduct.imageUrl ? (
                  <img 
                    src={selectedProduct.imageUrl} 
                    alt={selectedProduct.name} 
                    className="w-full h-full object-contain p-8 group-hover:scale-105 transition-transform duration-700" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedProduct.name)}&background=f1f5f9&color=0f172a&size=512&font-size=0.33`}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain p-8 opacity-50 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 rounded-lg"
                    loading="lazy"
                  />
                )}
                
                {/* Brand Badge */}
                {selectedProduct.brand && (
                  <div className="absolute top-4 left-4 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5 leading-none">Brand</span>
                    <span className="text-sm font-bold text-slate-800 leading-none">{selectedProduct.brand}</span>
                  </div>
                )}
              </div>

              {/* Right: Content Section */}
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 sm:p-12 custom-scrollbar">
                  <div className="space-y-8">
                    {/* Header */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded border border-slate-200">
                          {selectedProduct.category}
                        </span>
                        {selectedProduct.stock > 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded border border-emerald-100">
                            In Stock
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-red-50 text-red-600 text-[10px] font-bold uppercase rounded border border-red-100">
                            Out of Stock
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 leading-tight">
                        {selectedProduct.name}
                      </h2>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-[#ef4a23]">৳{selectedProduct.price.toLocaleString()}</span>
                        <span className="text-sm font-bold text-slate-400 line-through">৳{(selectedProduct.price * 1.1).toFixed(0)}</span>
                      </div>
                    </div>

                    {/* Description */}
                    {selectedProduct.description && (
                      <div className="space-y-3">
                        <h4 className="text-[13px] font-bold text-slate-800 uppercase flex items-center gap-2">
                          <div className="w-1 h-4 bg-[#ef4a23] rounded-full" />
                          Overview
                        </h4>
                        <p className="text-slate-600 text-sm leading-relaxed">
                          {selectedProduct.description}
                        </p>
                      </div>
                    )}

                    {/* Key Features */}
                    {selectedProduct.keyFeatures && selectedProduct.keyFeatures.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-[13px] font-bold text-slate-800 uppercase flex items-center gap-2">
                          <div className="w-1 h-4 bg-[#ef4a23] rounded-full" />
                          Key Features
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {selectedProduct.keyFeatures.map((feature, i) => (
                            <div key={i} className="flex items-start gap-3 group">
                              <div className="mt-1">
                                <ListChecks size={14} className="text-[#ef4a23]" />
                              </div>
                              <span className="text-sm text-slate-700">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Specifications */}
                    {selectedProduct.specifications && Object.keys(selectedProduct.specifications).length > 0 && (
                      <div className="space-y-6">
                        <h4 className="text-[13px] font-bold text-slate-800 uppercase flex items-center gap-2">
                          <div className="w-1 h-4 bg-[#ef4a23] rounded-full" />
                          Technical Specifications
                        </h4>
                        <div className="border border-slate-200 rounded divide-y divide-slate-200">
                          {Object.entries(selectedProduct.specifications).map(([key, val]) => (
                            <div key={key} className="flex flex-col sm:flex-row bg-white hover:bg-slate-50 transition-colors">
                              <div className="sm:w-1/3 px-4 py-2.5 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200">
                                <span className="text-xs font-bold text-slate-600">{key}</span>
                              </div>
                              <div className="flex-1 px-4 py-2.5">
                                <span className="text-sm text-slate-800">{val}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-slate-600 mb-1">Secure Checkout</p>
                    <div className="flex items-center gap-3 text-slate-400">
                      <ShieldCheck size={16} />
                      <Globe size={16} />
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      handleAddToCart(selectedProduct, e);
                      setSelectedProduct(null);
                    }}
                    disabled={selectedProduct.stock <= 0}
                    className="flex-1 sm:flex-none px-8 py-3 bg-[#ef4a23] text-white rounded font-bold text-sm hover:bg-[#d8401e] transition-colors flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Buy Now
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setLightboxImage(null)}
          >
            <button 
              className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded hover:scale-105 p-3 transition-all duration-300"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImage(null);
              }}
            >
              <X size={24} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={lightboxImage} 
              alt="Product" 
              className="max-w-full max-h-[85vh] object-contain shadow-2xl" 
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-[#081621] text-white/80 pt-10 pb-20 sm:pb-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center pb-20 sm:pb-0">
          
          <div className="bg-[#0b1a29] rounded-full px-6 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-10 w-[240px] sm:w-auto shadow-[0_4px_10px_rgba(0,0,0,0.2)]">
             <div className="flex items-center gap-3 w-full justify-center">
               <MapPin size={24} className="text-white" />
               <div className="text-left">
                  <p className="text-white/50 text-[10px] leading-tight">Store Locator</p>
                  <p className="text-[#ef4a23] text-lg font-semibold leading-tight">Find Our Stores</p>
               </div>
             </div>
          </div>

          <h4 className="font-bold text-white uppercase tracking-[0.2em] text-sm mb-6">About Us</h4>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 mb-10 text-[13px] text-white/60">
             {[
               'Affiliate Program', 'EMI Terms', 'About Us', 'Online Delivery', 
               'Privacy Policy', 'Terms and Conditions', 'Refund and Return Policy', 
               'Star Point Policy', 'Career', 'Blog', 'Contact Us', 'Brands'
             ].map((link, idx, arr) => (
               <div key={link} className="flex items-center gap-4">
                 <button onClick={() => handleDemo(link)} className="hover:text-[#ef4a23] transition-colors">{link}</button>
                 {idx !== arr.length - 1 && <span className="text-white/20">•</span>}
               </div>
             ))}
          </div>

          <h4 className="font-bold text-white uppercase tracking-[0.2em] text-sm mb-6">Stay Connected</h4>
          <div className="text-[13px] text-white/60 space-y-6 mb-8 w-full max-w-sm mx-auto">
             <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-white tracking-tighter mb-1">SDC<span className="text-[#ef4a23]">.</span></span>
                <span className="text-[10px] font-mono text-white/30 tracking-[0.4em] uppercase">Smart Digital Care</span>
             </div>

             <div className="space-y-2 border-y border-white/5 py-6">
                <div className="flex flex-col gap-1">
                   <p className="text-white font-bold text-lg tracking-tight">Cantonment Board Jame Masjid Market</p>
                   <p className="text-white/40 font-serif italic">ক্যান্টনমেন্ট বোর্ড জামে মসজিদ মার্কেট, কুমিল্লা</p>
                </div>
                <a 
                  href="https://www.google.com/maps/search/?api=1&query=Cantonment+Board+Jame+Masjid+Market+Cumilla" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#ef4a23] hover:text-white transition-colors text-xs font-mono uppercase tracking-widest pt-2"
                >
                  <Globe size={14} /> Get Directions
                </a>
             </div>

             <div className="grid grid-cols-2 gap-4 text-left">
                <div className="bg-white/5 p-4 rounded-lg border border-white/10 group hover:border-[#ef4a23]/50 transition-colors">
                   <p className="text-[10px] uppercase font-mono text-white/40 mb-1 group-hover:text-[#ef4a23]">Care Desk</p>
                   <p className="text-white font-mono font-bold">+8801766407313</p>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10 group hover:border-[#ef4a23]/50 transition-colors">
                   <p className="text-[10px] uppercase font-mono text-white/40 mb-1 group-hover:text-[#ef4a23]">Mobile Fixer</p>
                   <p className="text-white font-mono font-bold">+8801854648690</p>
                </div>
             </div>
             
             <div className="pt-2">
                <a href="mailto:support@sdccumilla.com" className="text-white/50 hover:text-white transition-colors font-mono text-[10px] tracking-widest uppercase">support@sdccumilla.com</a>
             </div>
          </div>

          <p className="text-[11px] text-white/50 mb-4">Experience SDC App on your mobile:</p>
          <div className="flex gap-4 justify-center mb-8">
             <button onClick={() => handleDemo('Google Play Store Download')} className="border border-white/20 rounded-lg px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Play_Arrow_logo.svg" alt="Play Store" className="w-5" />
                <div className="text-left leading-tight">
                   <p className="text-[9px] text-white/60">Download on</p>
                   <p className="text-sm text-white font-medium">Google Play</p>
                </div>
             </button>
             <button onClick={() => handleDemo('App Store Download')} className="border border-white/20 rounded-lg px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors">
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/31/Apple_logo_white.svg" alt="App Store" className="w-4" />
                <div className="text-left leading-tight">
                   <p className="text-[9px] text-white/60">Download on</p>
                   <p className="text-sm text-white font-medium">App Store</p>
                </div>
             </button>
          </div>

          <div className="flex items-center justify-center gap-4 border-t border-white/10 pt-8 w-full">
            {['Twitter', 'Instagram', 'Facebook', 'LinkedIn'].map(social => (
              <button key={social} onClick={() => handleDemo(`${social} Profile`)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-[#ef4a23] transition-all duration-300">
                <Globe size={18} />
              </button>
            ))}
          </div>

        </div>
      </footer>

      {/* Mobile Bottom Navigation Menu */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#081621] border-t border-[#ef4a23]/30 flex justify-around items-center p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.5)]">
        <button onClick={() => handleDemo('Offers View')} className="flex flex-col items-center justify-center w-16 h-12 text-white/80 hover:text-white transition-colors">
          <Gift size={20} className="mb-1" />
          <span className="text-[9px] font-medium leading-none">Offers</span>
        </button>
        <button onClick={() => handleDemo('Flash Deals')} className="flex flex-col items-center justify-center w-16 h-12 text-white/80 hover:text-white transition-colors">
          <Zap size={20} className="mb-1" />
          <span className="text-[9px] font-medium leading-none">Flash Deal</span>
        </button>
        <button onClick={() => handleDemo('PC Builder')} className="flex flex-col items-center justify-center w-16 h-12 text-white/80 hover:text-white transition-colors">
          <Monitor size={20} className="mb-1" />
          <span className="text-[9px] font-medium leading-none">PC Builder</span>
        </button>
        <button onClick={() => handleDemo('Product Comparison')} className="flex flex-col items-center justify-center w-16 h-12 text-white/80 hover:text-white transition-colors">
          <ListChecks size={20} className="mb-1" />
          <span className="text-[9px] font-medium leading-none">Compare (0)</span>
        </button>
        <a href="#/admin" className="flex flex-col items-center justify-center w-16 h-12 text-white/80 hover:text-white transition-colors">
          <User size={20} className="mb-1 text-[#ef4a23]" />
          <span className="text-[9px] font-medium leading-none text-[#ef4a23]">{user ? 'Dashboard' : 'Account'}</span>
        </a>
      </nav>

      {/* Mobile Sidebar Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/60 z-[100] sm:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white z-[101] sm:hidden flex flex-col overflow-hidden"
            >
              {/* Sidebar Header */}
              <div className="bg-[#081621] p-4 flex items-center justify-between pb-6">
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                >
                  <X size={20} />
                </button>
                <div className="flex-1 flex justify-center">
                  <Logo className="w-8 h-8 text-[#ef4a23]" />
                </div>
                <div className="relative">
                  <ShoppingBag size={24} className="text-white" />
                  <span className="absolute -top-1 -right-1 bg-[#ef4a23] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">0</span>
                </div>
              </div>

              {/* Sidebar Links */}
              <div className="flex-1 overflow-y-auto w-full bg-white flex flex-col">
                {[
                  'Component', 'Monitor', 'Power', 'Phone', 'Tablet', 'Office Equipment', 
                  'Camera', 'Security', 'Networking', 'Software', 'Server & Storage',
                  'Accessories', 'Gadget', 'Gaming', 'TV', 'Appliance'
                ].map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      if (categories.includes(item) || item === 'All') {
                        setActiveCategory(item);
                      } else {
                        handleDemo(`Category: ${item}`);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between px-6 py-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors",
                      item === 'Server & Storage' ? "text-[#ef4a23]" : "text-slate-800"
                    )}
                  >
                    <span className="font-medium text-sm">{item}</span>
                    <span className="text-slate-400 font-light text-xl">+</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Care HUD */}
      <div className="fixed bottom-24 right-6 z-[60] hidden lg:flex flex-col gap-3">
         <motion.button 
           whileHover={{ scale: 1.05 }}
           whileTap={{ scale: 0.95 }}
           onClick={() => handleDemo('Live Diagnostic Support')}
           className="bg-[#081621] text-[#ef4a23] p-4 rounded-2xl shadow-2xl border border-[#ef4a23]/20 flex items-center gap-4 group overflow-hidden"
         >
            <div className="flex flex-col text-right">
               <span className="text-[9px] font-mono uppercase tracking-[0.2em] opacity-50">Support Active</span>
               <span className="text-white font-mono text-xs font-bold whitespace-nowrap">+8801766407313</span>
            </div>
            <div className="w-10 h-10 bg-[#ef4a23] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#ef4a23]/30">
               <Phone size={18} />
            </div>
         </motion.button>
         
         <motion.button 
           whileHover={{ scale: 1.05 }}
           whileTap={{ scale: 0.95 }}
           onClick={() => handleDemo('Mobile Fixing Line')}
           className="bg-white text-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-100 flex items-center gap-4 group"
         >
            <div className="flex flex-col text-right">
               <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-400">Fixing Guru</span>
               <span className="text-slate-900 font-mono text-xs font-bold whitespace-nowrap">+8801854648690</span>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-800 border border-slate-200 group-hover:bg-[#ef4a23] group-hover:text-white transition-colors">
               <Wrench size={18} />
            </div>
         </motion.button>
      </div>

    </div>
  );
}
