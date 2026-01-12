import React, { useState } from 'react';
import { AppData, PaymentMethod, StockStatus } from '../types';
import { Icons } from '../constants';

interface Props {
  data: AppData;
}

type ReportType = 'Stock' | 'Sales' | 'Purchase' | 'ProfitLoss' | 'Payments';

const Reports: React.FC<Props> = ({ data }) => {
  const [activeReport, setActiveReport] = useState<ReportType>('Sales');
  const [showToast, setShowToast] = useState(false);

  const getStockData = () => {
    return data.stocks.map(stock => {
      const model = data.models.find(m => m.id === stock.modelId);
      return {
        'Brand Name': model?.brand || 'N/A',
        'Model Name': model?.modelName || 'N/A',
        'IMEI': stock.imei,
        'Purchase Price': model?.purchasePrice || 0,
        'Selling Price': model?.sellingPrice || 0,
        'Stock Status': stock.status
      };
    });
  };

  const getSalesData = () => {
    const rows: any[] = [];
    data.invoices.forEach(inv => {
      inv.items.forEach(item => {
        rows.push({
          'Invoice Number': inv.invoiceNumber,
          'Date': new Date(inv.date).toLocaleDateString(),
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

  const getProfitLossData = () => {
    const months: Record<string, { purchase: number; sales: number; discount: number }> = {};
    
    data.stocks.forEach(stock => {
      const model = data.models.find(m => m.id === stock.modelId);
      const month = stock.dateAdded.slice(0, 7);
      if (!months[month]) months[month] = { purchase: 0, sales: 0, discount: 0 };
      months[month].purchase += (model?.purchasePrice || 0);
    });

    data.invoices.forEach(inv => {
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
    data.invoices.forEach(inv => {
      inv.payments.forEach(p => {
        rows.push({
          'Date': new Date(inv.date).toLocaleDateString(),
          'Invoice Number': inv.invoiceNumber,
          'Payment Method': p.method,
          'Bank Name': p.bankName || 'N/A',
          'Amount': p.amount
        });
      });
    });
    return rows;
  };

  const downloadExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("Error: Excel library not loaded. Please wait.");
      return;
    }

    let reportData: any[] = [];
    let fileName = '';
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');

    switch (activeReport) {
      case 'Stock':
        reportData = getStockData();
        fileName = `Stock_Report_${dateStr}.xlsx`;
        break;
      case 'Sales':
        reportData = getSalesData();
        fileName = `Sales_Report_${dateStr}.xlsx`;
        break;
      case 'ProfitLoss':
        reportData = getProfitLossData();
        fileName = `Profit_Loss_Report_${dateStr}.xlsx`;
        break;
      case 'Payments':
        reportData = getPaymentData();
        fileName = `Payment_Report_${dateStr}.xlsx`;
        break;
      case 'Purchase':
        reportData = getStockData().map(s => ({
          'Date': 'N/A',
          'Item': `${s['Brand Name']} ${s['Model Name']}`,
          'IMEI': s.IMEI,
          'Cost': s['Purchase Price']
        }));
        fileName = `Purchase_Report_${dateStr}.xlsx`;
        break;
    }

    if (reportData.length === 0) {
      alert("No data available for this report.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeReport);
    XLSX.writeFile(workbook, fileName);

    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const currentPreviewData = () => {
    switch (activeReport) {
      case 'Stock': return getStockData();
      case 'Sales': return getSalesData();
      case 'ProfitLoss': return getProfitLossData();
      case 'Payments': return getPaymentData();
      default: return [];
    }
  };

  const preview = currentPreviewData().slice(0, 10);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Financial Reports</h2>
          <p className="text-slate-500 text-sm">Download accounting data and track your shop performance.</p>
        </div>
        <button 
          onClick={downloadExcel}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black flex items-center shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          DOWNLOAD {activeReport.toUpperCase()} EXCEL
        </button>
      </div>

      <div className="flex overflow-x-auto gap-2 p-1 bg-slate-100 rounded-2xl no-scrollbar">
        {[
          { id: 'Sales', label: 'Sales Report', icon: Icons.Invoice },
          { id: 'Stock', label: 'Stock Report', icon: Icons.Stock },
          { id: 'ProfitLoss', label: 'Profit & Loss', icon: Icons.Report },
          { id: 'Payments', label: 'Payment Inbox', icon: Icons.Dashboard },
          { id: 'Purchase', label: 'Purchase History', icon: Icons.Plus },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as ReportType)}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeReport === tab.id 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Data Preview (Recent 10)</h3>
          <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
            TOTAL ROWS: {currentPreviewData().length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white border-b">
              <tr>
                {preview.length > 0 && Object.keys(preview[0]).map(header => (
                  <th key={header} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {preview.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    No data available for this criteria.
                  </td>
                </tr>
              ) : (
                preview.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="px-6 py-4 text-sm font-bold text-slate-900 whitespace-nowrap">
                        {typeof val === 'number' && !Object.keys(row)[j].includes('IMEI')
                          ? `${val.toLocaleString()}` 
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
        <div className="fixed bottom-24 md:bottom-8 right-8 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-right-full duration-300 z-[100]">
          <div className="bg-emerald-500 rounded-full p-1 text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="font-bold text-sm">Excel file downloaded successfully</span>
        </div>
      )}
    </div>
  );
};

export default Reports;