import { _supabase } from '../../../SUPABASE/supabase_admin_conn.js'; 

const TABLE_ORDER = 'orders';         
const COL_ORDER_ID = 'order_id';      
const COL_CREATED_AT = 'created_at';  
const COL_STATUS = 'status';          
const COL_TOTAL = 'total_amount';     

let allOrders = [];

export async function initAdminOrder() {
    console.log("Initializing Admin Order Management...");
    
    initYearDropdown();
    bindEvents();
    
    await fetchAllOrders();
}

function initYearDropdown() {
    const yearSelect = document.getElementById('ao-year');
    if (!yearSelect) return;
    yearSelect.innerHTML = '<option value="">All Years</option>';
    const currentYear = new Date().getFullYear(); 
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
}

function bindEvents() {
    document.getElementById('ao-btn-search')?.addEventListener('click', filterAndRenderOrders);
    document.getElementById('ao-btn-reset')?.addEventListener('click', () => {
        document.getElementById('ao-search').value = '';
        document.getElementById('ao-year').value = '';
        document.getElementById('ao-month').value = '';
        filterAndRenderOrders();
    });

    // 🌟 弹窗关闭逻辑
    document.getElementById('ao-modal-close')?.addEventListener('click', () => {
        document.getElementById('ao-modal-overlay').style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        const overlay = document.getElementById('ao-modal-overlay');
        if (e.target === overlay) overlay.style.display = 'none';
    });
}

async function fetchAllOrders() {
    try {
        const { data, error } = await _supabase
            .from(TABLE_ORDER)
            .select(`*, profiles (*)`)
            .order(COL_CREATED_AT, { ascending: false });

        if (error) throw error;
        allOrders = data || [];
        filterAndRenderOrders(); 
    } catch (error) {
        console.error("Fetch Error:", error);
        document.getElementById('ao-tbody').innerHTML = `<tr><td colspan="6" class="ao-empty">Error loading data.</td></tr>`;
    }
}

function filterAndRenderOrders() {
    const searchKeyword = (document.getElementById('ao-search')?.value || '').toLowerCase().trim();
    const filterYear = document.getElementById('ao-year')?.value;
    const filterMonth = document.getElementById('ao-month')?.value;

    const filtered = allOrders.filter(order => {
        const orderDate = new Date(order[COL_CREATED_AT]);
        if (filterYear && filterYear !== orderDate.getFullYear().toString()) return false;
        if (filterMonth && filterMonth !== (orderDate.getMonth() + 1).toString()) return false;

        if (searchKeyword) {
            const oId = (order[COL_ORDER_ID] || '').toLowerCase();
            const profile = order.profiles || {};
            const cName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim().toLowerCase();
            if (!oId.includes(searchKeyword) && !cName.includes(searchKeyword)) return false;
        }
        return true;
    });
    renderTable(filtered);
}

function renderTable(dataArray) {
    const tbody = document.getElementById('ao-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (dataArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="ao-empty">No orders found.</td></tr>`;
        return;
    }

    dataArray.forEach(order => {
        const orderId = order[COL_ORDER_ID];
        const dateObj = new Date(order[COL_CREATED_AT]);
        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
        
        const profile = order.profiles || {};
        const customerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Guest';
        const currentStatus = (order[COL_STATUS] || 'order placed').toLowerCase();

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${orderId}</strong></td>
            <td style="color:#64748b; font-size: 13px;">${dateStr}</td>
            <td>${customerName}</td>
            <td style="font-weight: bold;">RM ${Number(order[COL_TOTAL]).toFixed(2)}</td>
            <td>
                <select class="status-select" data-id="${orderId}" style="${getStatusStyle(currentStatus)}">
                    <option value="order placed" ${currentStatus === 'order placed' ? 'selected' : ''}>Order Placed</option>
                    <option value="delivered" ${currentStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled" ${currentStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>
                <button class="view-detail-btn ao-btn" style="padding: 5px 12px; font-size: 12px; background: #6366f1; color: white;">View Detail</button>
            </td>
        `;

        // 🌟 绑定状态更新
        tr.querySelector('.status-select').addEventListener('change', (e) => handleStatusChange(e, orderId));
        
        // 🌟 核心：绑定详情弹窗
        tr.querySelector('.view-detail-btn').addEventListener('click', () => openOrderDetail(order));

        tbody.appendChild(tr);
    });
}

// ─── 7. 核心功能：打开详情弹窗 ───
async function openOrderDetail(order) {
    const overlay = document.getElementById('ao-modal-overlay');
    const itemsBody = document.getElementById('modal-items-body');
    
    // 1. 立即填入已有的客户基础信息
    document.getElementById('modal-order-id').innerText = `Details for Order: ${order.order_id}`;
    const p = order.profiles || {};
    document.getElementById('modal-cust-name').innerText = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Guest Customer';
    document.getElementById('modal-cust-email').innerText = p.email || 'No email provided';
    document.getElementById('modal-cust-phone').innerText = p.phone || 'No phone provided';
    document.getElementById('modal-cust-address').innerText = p.address || 'No shipping address provided';
    document.getElementById('modal-grand-total').innerText = `RM ${Number(order.total_amount).toFixed(2)}`;

    // 2. 显示 Loading 状态
    itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">Loading items...</td></tr>`;
    overlay.style.display = 'flex';

    try {
        // 3. 联表查询该订单的所有明细商品
        const { data: items, error } = await _supabase
            .from('order_item')
            .select(`
                *,
                structure:structure_id (
                    structure_name, colour, image_url,
                    furniture:furniture_id ( furniture_name )
                )
            `)
            .eq('order_id', order.order_id);

        if (error) throw error;

        // 4. 渲染商品明细
        itemsBody.innerHTML = '';
        if (!items || items.length === 0) {
            itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px;">No items found.</td></tr>`;
        } else {
            items.forEach(item => {
                const s = item.structure || {};
                const f = s.furniture || {};
                const row = document.createElement('tr');
                row.style.borderBottom = "1px solid #f1f5f9";
                row.innerHTML = `
                    <td style="padding: 12px 5px; display: flex; align-items: center; gap: 10px;">
                        <img src="${s.image_url || '../IMAGES/placeholder.png'}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; background: #f8fafc;">
                        <div>
                            <div style="font-weight: 600; color: #1e293b;">${f.furniture_name || 'Product'}</div>
                            <div style="font-size: 11px; color: #64748b;">${s.structure_name || ''} - ${s.colour || ''}</div>
                        </div>
                    </td>
                    <td style="padding: 12px 5px;">RM ${Number(item.unit_price || 0).toFixed(2)}</td>
                    <td style="padding: 12px 5px; text-align: center;">x${item.quantity}</td>
                    <td style="padding: 12px 5px; text-align: right; font-weight: 600;">RM ${Number(item.subtotal || 0).toFixed(2)}</td>
                `;
                itemsBody.appendChild(row);
            });
        }
    } catch (err) {
        console.error("Error loading order items:", err);
        itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#ef4444;">Failed to load items.</td></tr>`;
    }
}

// (handleStatusChange 和 getStatusStyle 保持不变)
async function handleStatusChange(event, orderId) {
    const newStatus = event.target.value;
    const confirmUpdate = confirm(`Change status to "${newStatus.toUpperCase()}"?`);
    if (!confirmUpdate) {
        const order = allOrders.find(o => o.order_id === orderId);
        event.target.value = (order.status || 'order placed').toLowerCase();
        return;
    }
    try {
        const { error } = await _supabase.from(TABLE_ORDER).update({ status: newStatus }).eq(COL_ORDER_ID, orderId);
        if (error) throw error;
        const order = allOrders.find(o => o.order_id === orderId);
        if (order) order.status = newStatus;
        event.target.style.cssText = getStatusStyle(newStatus);
    } catch (err) {
        alert("Update failed.");
    }
}

function getStatusStyle(status) {
    switch (status.toLowerCase()) {
        case 'order placed': return 'background: #fef9c3; color: #a16207; border-color: #fde047;';
        case 'delivered': return 'background: #dcfce7; color: #15803d; border-color: #86efac;';
        case 'cancelled': return 'background: #fee2e2; color: #b91c1c; border-color: #fca5a5;';
        default: return 'background: #f1f5f9; color: #475569; border-color: #cbd5e1;';
    }
}