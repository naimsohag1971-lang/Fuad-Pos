
import React, { useState, useMemo } from 'react';
import { AppData, PaymentMethod, StockStatus } from '../types';
import { Icons } from '../constants';

interface Props {
  data: AppData;
}

type ReportType = 'Stock' | 'Sales' | 'Purchase' | 'ProfitLoss' | 'Payments';
type DatePeriod = 'all' | 'today' | '7days' | 'month' | 'custom';

const Reports: React.FC<Props> = ({ data }) => {
  const [activeReport, setActiveReport] = useState<ReportType>('Sales');
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showToast, setShowToast] = useState(false);

  const isDateInPeriod = (dateStr: string) => {
    if (datePeriod === 'all') return true;
    const date = new Date(dateStr);
    const now = new Date();
    
    if (datePeriod === 'today') {
      return date.toDateString() === now.toDateString();
    } else if (datePeriod === '7days') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return date >= weekAgo;
    } else if (datePeriod === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    } else if (datePeriod === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    }
    return true;
  };

  const getStockData = () => {
    return data.stocks
      .filter(s => isDateInPeriod(s.dateAdded))
      .map(stock => {
        const model = data.models.find(m => m.id === stock.modelId);
        return {
          'Added Date': new Date(stock.dateAdded).toLocaleDateString('en-GB'),
          'Brand Name': model?.brand || 'N/A',
          'Model Name': model?.modelName || 'N/A',
          'IMEI': stock.imei,
          'Purchase Price': stock.purchasePrice || 0,
          'Selling Price': stock.sellingPrice || 0,
          'Stock Status': stock.status
        };
      });
  };

  const getSalesData = () => {
    const rows: any[] = [];
    data.invoices
      .filter(inv => isDateInPeriod(inv.date))
      .forEach(inv => {
        inv.items.forEach(item => {
          rows.push({
            'Invoice Number': inv.invoiceNumber,
            'Date': new Date(inv.date).toLocaleDateString('en-GB'),
            'Customer Name': inv.customerName,
            'Customer Phone': inv.customerPhone,
            'IMEI': item.imei,
            'Model Name': `${item.brand} ${item.modelName}`,
            'Selling Price': item.price,
            'Paid Amount': inv.paidAmount,
            'Due Amount': inv.dueAmount
          });
        });
      });
    return rows;
  };

  const getPurchaseHistoryData = () => {
    const rows: any[] = [];
    data.purchases
      .filter(p => isDateInPeriod(p.date))
      .forEach(p => {
        p.items.forEach(item => {
          rows.push({
            'Date': new Date(p.date).toLocaleDateString('en-GB'),
            'Purchase Number': p.purchaseNumber,
            'Supplier': p.supplierName,
            'Item': `${item.brand} ${item.modelName}`,
            'IMEIs': item.imeis.join(', '),
            'Qty': item.imeis.length,
            'Cost': item.costPrice,
            'Subtotal': item.costPrice * item.imeis.length,
            'Total Paid': p.paidAmount,
            'Total Due': p.dueAmount
          });
        });
      });
    return rows;
  };

  const getProfitLossData = () => {
    const months: Record<string, { purchase: number; sales: number; discount: number }> = {};
    
    data.stocks
      .filter(s => isDateInPeriod(s.dateAdded))
      .forEach(stock => {
        const month = stock.dateAdded.slice(0, 7);
        if (!months[month]) months[month] = { purchase: 0, sales: 0, discount: 0 };
        months[month].purchase += (stock.purchasePrice || 0);
      });

    data.invoices
      .filter(inv => isDateInPeriod(inv.date))
      .forEach(inv => {
        const month = inv.date.slice(0, 7);
        if (!months[month]) months[month] = { purchase: 0, sales: 0, discount: 0 };
        months[month].sales += inv.total;
        months[month].discount += inv.discount;
      });

    return Object.entries(months).map(([month, vals]) => ({
      'Month': month,
      'Total Purchase Amount': vals.purchase,
      'Total Sales Amount': vals.sales,
      'Profit': Math.max(0, vals.sales - vals.purchase),
      'Loss': Math.max(0, vals.purchase - vals.sales)
    }));
  };

  const getPaymentData = () => {
    const rows: any[] = [];
    data.invoices
      .filter(inv => isDateInPeriod(inv.date))
      .forEach(inv => {
        inv.payments.forEach(p => {
          rows.push({
            'Date': new Date(inv.date).toLocaleDateString('en-GB'),
            'Invoice Number': inv.invoiceNumber,
            'Payment Method': p.method,
            'Bank / Phone Ref': p.bankName || p.paymentPhone || 'N/A',
            'Transaction ID': p.transactionId || 'N/A',
            'Amount': p.amount
          });
        });
      });
    return rows;
  };

  const currentReportData = useMemo(() => {
    switch (activeReport) {
      case 'Stock': return getStockData();
      case 'Sales': return getSalesData();
      case 'ProfitLoss': return getProfitLossData();
      case 'Payments': return getPaymentData();
      case 'Purchase': return getPurchaseHistoryData();
      default: return [];
    }
  }, [data, activeReport, datePeriod, startDate, endDate]);

  const totalCollection = useMemo(() => {
    if (activeReport !== 'Payments') return 0;
    return currentReportData.reduce((sum, row) => sum + (row.Amount || 0), 0);
  }, [currentReportData, activeReport]);

  const downloadExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("Error: Excel library not loaded. Please wait.");
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
    const fileName = `${activeReport}_Report_${dateStr}.xlsx`;

    if (currentReportData.length === 0) {
      alert("No data available for this report.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(currentReportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeReport);
    XLSX.writeFile(workbook, fileName);

    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const preview = currentReportData.slice(0, 25);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Analytics & Audit</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Export financial datasets for external accounting</p>
        </div>
        <button 
          onClick={downloadExcel}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black flex items-center shadow-2xl hover:bg-black transition-all active:scale-95 uppercase text-[10px] tracking-widest"
        >
          <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export {activeReport} to Excel
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex overflow-x-auto gap-2 p-1.5 bg-slate-50 rounded-2xl no-scrollbar border border-slate-100">
          {[
            { id: 'Sales', label: 'Sales Report', icon: Icons.Invoice },
            { id: 'Stock', label: 'Stock Status', icon: Icons.Stock },
            { id: 'ProfitLoss', label: 'Profit & Loss', icon: Icons.Report },
            { id: 'Payments', label: 'Payments Report', icon: Icons.Dashboard },
            { id: 'Purchase', label: 'Purchase Logs', icon: Icons.Plus },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as ReportType)}
              className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap transition-all ${
                activeReport === tab.id 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="scale-75"><tab.icon /></div>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          {[
            { id: 'all', label: 'All Time' },
            { id: 'today', label: 'Today' },
            { id: '7days', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'Custom Range' }
          ].map(btn => (
            <button 
              key={btn.id}
              onClick={() => setDatePeriod(btn.id as DatePeriod)}
              className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${datePeriod === btn.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border text-slate-400 hover:border-slate-300'}`}
            >
              {btn.label}
            </button>
          ))}

          {datePeriod === 'custom' && (
            <div className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm ml-2">
              <div className="flex items-center space-x-2">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">From</label>
                <input 
                  type="date" 
                  className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                />
              </div>
              <div className="w-2 h-0.5 bg-slate-100 rounded-full"></div>
              <div className="flex items-center space-x-2">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">To</label>
                <input 
                  type="date" 
                  className="bg-slate-50 border-none rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
          <div className="space-y-1">
            <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-[10px] flex items-center">
              <span className="w-1.5 h-3 bg-blue-600 rounded-full mr-3"></span>
              Dataset Preview
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Showing filtered records for {activeReport}</p>
          </div>
          <div className="flex items-center gap-4">
            {activeReport === 'Payments' && (
              <div className="px-5 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col items-end">
                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Total Collection</span>
                <span className="text-sm font-black text-emerald-700 leading-none">{totalCollection.toLocaleString()}</span>
              </div>
            )}
            <span className="text-[10px] font-black text-slate-900 bg-white border px-4 py-2 rounded-xl shadow-sm uppercase">
              Count: {currentReportData.length}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                {preview.length > 0 && Object.keys(preview[0]).map(header => (
                  <th key={header} className="px-8 py-5 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {preview.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-8 py-24 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
                    No records found for the selected period
                  </td>
                </tr>
              ) : (
                preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="px-8 py-5 text-[11px] font-bold text-slate-900 whitespace-nowrap max-w-[220px] truncate uppercase" title={String(val)}>
                        {typeof val === 'number' && !Object.keys(row)[j].includes('IMEI') && !Object.keys(row)[j].includes('ID')
                          ? val.toLocaleString()
                          : val}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showToast && (
        <div className="fixed bottom-12 right-12 bg-slate-900 text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center space-x-4 animate-in slide-in-from-right-full duration-500 z-[200] border border-slate-800">
          <div className="bg-emerald-500 rounded-full p-1.5 text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-black text-[10px] uppercase tracking-widest leading-none mb-1">Export Complete</p>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Excel file has been saved to your drive</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
