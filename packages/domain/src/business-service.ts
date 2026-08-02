import crypto = require("node:crypto");
import { OpenSrcWaError } from "../../core/src/errors";

export interface BusinessProfile {
  sessionId: string;
  name: string;
  description: string;
  email: string | null;
  website: string | null;
  address: string | null;
  categories: string[];
  updatedAt: string;
}
export interface CatalogProduct {
  productId: string;
  sessionId: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  imageMediaIds: string[];
  retailerId: string | null;
  url: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export class BusinessService {
  private readonly profiles = new Map<string, BusinessProfile>();
  private readonly products = new Map<string, CatalogProduct>();

  public setProfile(input: { sessionId: string; name: string; description?: string; email?: string; website?: string; address?: string; categories?: string[] }): BusinessProfile {
    const profile: BusinessProfile = {
      sessionId: input.sessionId,
      name: input.name,
      description: input.description ?? "",
      email: input.email ?? null,
      website: input.website ?? null,
      address: input.address ?? null,
      categories: [...new Set(input.categories ?? [])],
      updatedAt: new Date().toISOString()
    };
    this.profiles.set(input.sessionId, profile);
    return cloneProfile(profile);
  }

  public getProfile(sessionId: string): BusinessProfile | null {
    const profile = this.profiles.get(sessionId);
    return profile ? cloneProfile(profile) : null;
  }

  public createProduct(input: { sessionId: string; name: string; description?: string; priceMinor: number; currency: string; imageMediaIds?: string[]; retailerId?: string; url?: string }): CatalogProduct {
    if (!Number.isInteger(input.priceMinor) || input.priceMinor < 0) throw new OpenSrcWaError({ code: "INVALID_PRODUCT_PRICE", category: "VALIDATION_ERROR", message: "Harga produk tidak valid" });
    const now = new Date().toISOString();
    const product: CatalogProduct = {
      productId: crypto.randomUUID(), sessionId: input.sessionId, name: input.name, description: input.description ?? "",
      priceMinor: input.priceMinor, currency: input.currency.toUpperCase(), imageMediaIds: [...new Set(input.imageMediaIds ?? [])],
      retailerId: input.retailerId ?? null, url: input.url ?? null, hidden: false, createdAt: now, updatedAt: now
    };
    this.products.set(product.productId, product);
    return cloneProduct(product);
  }

  public listProducts(sessionId: string, includeHidden = false): CatalogProduct[] {
    return [...this.products.values()].filter((product) => product.sessionId === sessionId && (includeHidden || !product.hidden)).map(cloneProduct);
  }

  public updateProduct(sessionId: string, productId: string, patch: { name?: string; description?: string; priceMinor?: number; currency?: string; imageMediaIds?: string[]; retailerId?: string | null; url?: string | null; hidden?: boolean }): CatalogProduct {
    const product = this.mutableProduct(sessionId, productId);
    if (patch.name !== undefined) product.name = patch.name;
    if (patch.description !== undefined) product.description = patch.description;
    if (patch.priceMinor !== undefined) {
      if (!Number.isInteger(patch.priceMinor) || patch.priceMinor < 0) throw new OpenSrcWaError({ code: "INVALID_PRODUCT_PRICE", category: "VALIDATION_ERROR", message: "Harga produk tidak valid" });
      product.priceMinor = patch.priceMinor;
    }
    if (patch.currency !== undefined) product.currency = patch.currency.toUpperCase();
    if (patch.imageMediaIds !== undefined) product.imageMediaIds = [...new Set(patch.imageMediaIds)];
    if (patch.retailerId !== undefined) product.retailerId = patch.retailerId;
    if (patch.url !== undefined) product.url = patch.url;
    if (patch.hidden !== undefined) product.hidden = patch.hidden;
    product.updatedAt = new Date().toISOString();
    return cloneProduct(product);
  }

  public deleteProduct(sessionId: string, productId: string): void {
    this.mutableProduct(sessionId, productId);
    this.products.delete(productId);
  }

  private mutableProduct(sessionId: string, productId: string): CatalogProduct {
    const product = this.products.get(productId);
    if (!product || product.sessionId !== sessionId) throw new OpenSrcWaError({ code: "PRODUCT_NOT_FOUND", category: "VALIDATION_ERROR", message: "Produk tidak ditemukan" });
    return product;
  }
}
function cloneProfile(profile: BusinessProfile): BusinessProfile { return { ...profile, categories: [...profile.categories] }; }
function cloneProduct(product: CatalogProduct): CatalogProduct { return { ...product, imageMediaIds: [...product.imageMediaIds] }; }
