import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js';
import { loadCustomerContent } from '../script.js';

let cartItemsData = []; // 存储当前拉取到的所有购物车明细数据

export async function initCart() {
    console.log("Initializing Cart Page...");

    try {
        // 1. 获取当前登录用户
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            alert("Please login to view your cart.");
            loadCustomerContent('home');
            return;
        }
        const userId = session.user.id;

        // 2. 先查询该用户是否拥有主购物车 (cart)
        let { data: cartData, error: cartError } = await _supabase
            .from('cart')
            .select('cart_id')
            .eq('user_id', userId)
            .single();

        if (cartError && cartError.code !== 'PGRST116') { // PGRST116 表示没有找到记录
            throw cartError;
        }

        // 如果用户还没有购物车，这里会是空状态
        if (!cartData) {
            renderEmptyCart();
            return;
        }

        const cartId = cartData.cart_id;

        // 3. 核心：联表查询购物车明细、款式信息、以及父级家具名字
        const { data: items, error: itemsError } = await _supabase
            .from('cart_item')
            .select(`
                cart_item_id,
                quantity,
                structure_id,
                structure:structure_id (
                    structure_name,
                    colour,
                    price,
                    image_url,
                    stock,
                    furniture:furniture_id ( furniture_name )
                )
            `)
            .eq('cart_id', cartId)
            .is('room_item_id', null); // 暂时无视 room_item

        if (itemsError) throw itemsError;
        console.log("🔍 Cart Items from DB:", items);

        cartItemsData = items || [];

        if (cartItemsData.length === 0) {
            renderEmptyCart();
        } else {
            renderCartItems();
        }

        // 绑定结算按钮事件
        document.getElementById('btn-checkout').onclick = handleCheckout;

    } catch (err) {
        console.error("Failed to load cart:", err);
        alert("Failed to load shopping cart.");
    }
}

// ----------------------------------------------------
// 🖼️ 渲染逻辑：空购物车提示
// ----------------------------------------------------
function renderEmptyCart() {
    const container = document.getElementById('cart-items-container');
    if (container) {
        // 🌟 动态生成空状态提示，覆盖掉容器里原来的内容
        container.innerHTML = `<p id="empty-cart-msg" style="text-align: center; color: #94a3b8; font-size: 18px; padding: 40px; margin: 0;">Your cart is empty. Let's go shopping!</p>`;
    }
    
    document.getElementById('cart-item-count').innerText = "0 items";
    document.getElementById('summary-count').innerText = "0";
    document.getElementById('summary-total').innerText = "RM 0.00";
    
    // 禁用 Checkout 按钮
    const btnCheckout = document.getElementById('btn-checkout');
    if (btnCheckout) {
        btnCheckout.disabled = true;
        btnCheckout.style.background = "#cbd5e1";
        btnCheckout.style.cursor = "not-allowed";
    }
}

// ----------------------------------------------------
// 🖼️ 渲染逻辑：生成商品列表卡片
// ----------------------------------------------------
function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;
    
    // 🌟 清空重绘（这会把之前的商品和可能存在的空状态提示一起清理干净）
    container.innerHTML = ''; 
    
    document.getElementById('cart-item-count').innerText = `${cartItemsData.length} item(s)`;

    cartItemsData.forEach(item => {
        const struct = item.structure || {};
        const furn = struct.furniture || {};

        const furName = furn.furniture_name || '<span style="color:red;">⚠️ 找不到 Furniture 表关联</span>';
        const structName = struct.structure_name || '<span style="color:red;">⚠️ 找不到 Structure 表关联</span>';
        
        const colour = struct.colour || 'Default';
        const price = Number(struct.price || 0);
        const qty = Number(item.quantity || 1);
        const subtotal = price * qty;
        const outOfStock = Number(struct.stock || 0) < qty;

        const card = document.createElement('div');
        card.style.cssText = "display: flex; gap: 20px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: transform 0.2s;";
        
        card.innerHTML = `
            <input type="checkbox" class="cart-checkbox" data-id="${item.cart_item_id}" data-price="${price}" data-qty="${qty}" 
                   style="width: 20px; height: 20px; cursor: pointer;" ${outOfStock ? 'disabled' : ''}>
            
            <img src="${struct.image_url || '../IMAGES/placeholder.png'}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid #f1f5f9;">
            
            <div style="flex-grow: 1;">
                <h3 style="margin: 0 0 5px 0; font-size: 18px; color: #1e2937;">${furName}</h3>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">${structName} • ${colour}</p>
                ${outOfStock ? `<span style="color:#e74c3c; font-size:13px; font-weight:bold;">⚠️ Not enough stock</span>` : ''}
            </div>

            <div style="text-align: right; min-width: 120px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                <div>
                    <div style="font-size: 18px; font-weight: bold; color: #1e2937; margin-bottom: 5px;">RM ${subtotal.toFixed(2)}</div>
                    <div style="font-size: 13px; color: #64748b;">RM ${price.toFixed(2)} x ${qty}</div>
                </div>
                
                <button class="btn-delete-cart-item" title="Remove Item" style="background: none; border: none; color: #ef4444; font-size: 18px; cursor: pointer; padding: 5px; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

        const deleteBtn = card.querySelector('.btn-delete-cart-item');
        deleteBtn.addEventListener('click', () => handleDeleteItem(item.cart_item_id));

        container.appendChild(card);
    });

    // 重新绑定勾选计算
    const checkboxes = document.querySelectorAll('.cart-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', calculateSummary);
    });
    
    // 初始化时触发一次计算
    calculateSummary();
}

// ----------------------------------------------------
// 🗑️ 核心功能：删除购物车明细
// ----------------------------------------------------
async function handleDeleteItem(cartItemId) {
    // 1. 给用户一个弹窗二次确认
    const confirmDelete = confirm("Are you sure you want to remove this item from your cart?");
    if (!confirmDelete) return;

    try {
        // 2. 向 Supabase 发送删除请求
        const { error } = await _supabase
            .from('cart_item')
            .delete()
            .eq('cart_item_id', cartItemId);

        if (error) throw error;

        // 3. 将其从本地数组中过滤掉
        cartItemsData = cartItemsData.filter(item => item.cart_item_id !== cartItemId);

        // 4. 更新前端视图
        if (cartItemsData.length === 0) {
            renderEmptyCart();
        } else {
            renderCartItems(); 
        }

    } catch (err) {
        console.error("Failed to delete cart item:", err);
        alert("Failed to remove item. Please try again.");
    }
}

// ----------------------------------------------------
// 🧮 逻辑计算：实时更新结算面板总价与按钮状态
// ----------------------------------------------------
function calculateSummary() {
    const checkboxes = document.querySelectorAll('.cart-checkbox:checked');
    let totalCount = 0;
    let totalPrice = 0;

    checkboxes.forEach(cb => {
        const price = parseFloat(cb.getAttribute('data-price'));
        const qty = parseInt(cb.getAttribute('data-qty'));
        totalCount += qty;
        totalPrice += (price * qty);
    });

    document.getElementById('summary-count').innerText = totalCount;
    document.getElementById('summary-total').innerText = `RM ${totalPrice.toFixed(2)}`;

    // 控制 Checkout 按钮的点亮与熄灭
    const btnCheckout = document.getElementById('btn-checkout');
    if (checkboxes.length > 0) {
        btnCheckout.disabled = false;
        btnCheckout.style.background = "#1e2937";
        btnCheckout.style.cursor = "pointer";
    } else {
        btnCheckout.disabled = true;
        btnCheckout.style.background = "#cbd5e1";
        btnCheckout.style.cursor = "not-allowed";
    }
}

// ----------------------------------------------------
// 🚀 路由跳转：带着选中的商品前往 Order 页面
// ----------------------------------------------------
function handleCheckout() {
    const checkboxes = document.querySelectorAll('.cart-checkbox:checked');
    const selectedCartItemIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

    if (selectedCartItemIds.length === 0) return;

    // 将选中的商品 ID 数组作为参数，传递给 Order 页面
    console.log("Proceeding to checkout with Cart Item IDs:", selectedCartItemIds);
    loadCustomerContent('order', { selectedItems: selectedCartItemIds.join(',') });
}