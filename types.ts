
export enum PaymentMethod {
  CASH = 'Cash',
  BKASH = 'bKash',
  NAGAD = 'Nagad',
  ROCKET = 'Rocket',
  CARD = 'Card'
}

export enum StockStatus {
  AVAILABLE = 'Available',
  SOLD = 'Sold'
}

export interface ShopAccount {
  name: string;
  address: string;
  phone: string;
  email?: string;
  logoUrl?: string;
  isRegistered: boolean;
  preparedBy?: string;
  ownerUsername?: string;
  inactivityTimeout?: number; // Minutes before auto-logout
}

export interface MobileModel {
  id: string;
  brand: string;
  modelName: string;
  purchasePrice: number;
  sellingPrice: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

export interface IMEIStock {
  imei: string;
  modelId: string;
  status: StockStatus;
  dateAdded: string;
  invoiceId?: string;
  purchaseId?: string;
  purchasePrice: number;
  sellingPrice: number;
}

export interface InvoiceItem {
  imei: string;
  modelName: string;
  brand: string;
  price: number;
}

export interface PurchaseItem {
  modelId: string;
  brand: string;
  modelName: string;
  imeis: string[];
  costPrice: number;
  sellingPrice: number;
}

export interface PaymentDetails {
  method: PaymentMethod;
  bankName?: string;
  paymentPhone?: string;
  cardType?: 'Debit' | 'Credit';
  transactionId: string;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  narration?: string; // Replaced 'attention' and 'destination' with just narration
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  payments: PaymentDetails[];
  paidAmount: number;
  dueAmount: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  date: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress?: string;
  items: PurchaseItem[];
  subtotal: number;
  vat: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  note?: string;
}

export interface AppData {
  shop: ShopAccount;
  models: MobileModel[];
  stocks: IMEIStock[];
  invoices: Invoice[];
  purchases: Purchase[];
  suppliers: Supplier[];
}
