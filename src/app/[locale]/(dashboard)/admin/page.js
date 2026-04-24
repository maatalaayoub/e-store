"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings, 
  Plus, 
  Search, 
  Bell, 
  Menu, 
  X,
  MoreVertical,
  LogOut
} from "lucide-react";

export default function AdminDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const stats = [
    { label: "Total Revenue", value: "$0.00", trend: "+0.0%" },
    { label: "Orders", value: "0", trend: "+0.0%" },
    { label: "Products", value: "0", trend: "+0.0%" },
    { label: "Active Customers", value: "0", trend: "+0.0%" },
  ];

  const recentProducts = [];

  return (
    <div className="flex min-h-screen bg-zinc-50">
      
      {/* MOBILE SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        className={`fixed inset-y-0 left-0 z-[100] w-64 border-r border-zinc-200 bg-white transition-all duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-[100%]"}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tighter text-blue-600 text-xl">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white text-xs">E</div>
            <span className="text-zinc-900">ADMIN.</span>
          </Link>
          <button className="lg:hidden text-zinc-500" onClick={() => setIsSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          <a href="#" className="flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600">
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
            <Package className="h-5 w-5" />
            Products
          </a>
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
            <ShoppingCart className="h-5 w-5" />
            Orders
          </a>
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
            <Users className="h-5 w-5" />
            Customers
          </a>
          <a href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
            <Settings className="h-5 w-5" />
            Store Settings
          </a>
        </nav>

        <div className="absolute w-full bottom-0 border-t border-zinc-200 p-4">
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
            <LogOut className="h-5 w-5" />
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* HEADER */}
        <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6 md:px-8">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden text-zinc-500 hover:text-zinc-900"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:flex relative items-center">
              <Search className="absolute left-3 h-4 w-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-64 rounded-full bg-zinc-50 pl-10 pr-4 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-zinc-500 hover:text-zinc-900">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              A
            </div>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h1 className="text-2xl font-bold text-zinc-900">Overview</h1>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 rounded-lg bg-white border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50">
                <Settings className="h-4 w-4" />
                Customize Store
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            </div>
          </div>

          {/* STATS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-6">
                <p className="text-sm font-medium text-zinc-500 mb-1">{stat.label}</p>
                <div className="flex items-end gap-2">
                  <h3 className="text-2xl font-bold text-zinc-900">{stat.value}</h3>
                  <span className="text-sm font-medium text-zinc-400 mb-1">{stat.trend}</span>
                </div>
              </div>
            ))}
          </div>

          {/* RECENT PRODUCTS TABLE */}
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden flex flex-col">
            <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Recent Products</h2>
              <a href="#" className="text-sm font-medium text-blue-600 hover:underline">View all</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-600">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 border-b border-zinc-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Product</th>
                    <th className="px-6 py-3 font-medium">Category</th>
                    <th className="px-6 py-3 font-medium">Price</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {recentProducts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-zinc-500">
                        No products have been added yet. Click "Add Product" to get started.
                      </td>
                    </tr>
                  ) : (
                    recentProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 font-medium text-zinc-900">{product.name}</td>
                        <td className="px-6 py-4">{product.category}</td>
                        <td className="px-6 py-4">{product.price}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            product.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                            product.status === 'Low Stock' ? 'bg-amber-50 text-amber-700' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-1 text-zinc-400 hover:text-zinc-900">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

    </div>
  );
}