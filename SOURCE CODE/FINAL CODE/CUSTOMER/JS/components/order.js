import { _supabase } from '../../../SUPABASE/supabase_customer_conn.js';
import { loadCustomerContent } from '../script.js';

let orderItemsData = [];
let currentUser = null;
let finalTotalAmount = 0;
let checkoutCartItemIds = []; // 记录这些商品的购物车ID，支付后要删掉

export async function initOrder(params) {
    console.log("Initializing Order Page with Params:", params);

    // 1. 检查是否有传过来的购物车商品参数
    if (!params || !params.selectedItems) {
        alert("No items selected for checkout.");
        loadCustomerContent('cart');
        return;
    }

    // 把 "id1,id2" 切割成数组
    checkoutCartItemIds = params.selectedItems.split(',');

    try {
        // 2. 验证用户登录状态并获取 Profile (收货地址)
        const { data: { session } } = await _supabase.auth.getSession();
        if (!session) {
            alert("Session expired. Please login again.");
            // 🌟 终极修复：购物车结算时发现没登录，直接踢去真实的登录页面
            window.location.href = 'cus_login.html'; 
            return; // 必须 return 阻断后续结算逻辑
        }
        
        const userId = session.user.id;
        
        const { data: profile } = await _supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        currentUser = profile;

        // 3. 渲染收货地址信息
        const shippingBox = document.getElementById('order-shipping-info');
        if (shippingBox && currentUser) {
            shippingBox.innerHTML = `
                <p style="margin:0 0 5px 0;"><strong>Name:</strong> ${currentUser.first_name} ${currentUser.last_name}</p>
                <p style="margin:0 0 5px 0;"><strong>Phone:</strong> ${currentUser.phone || 'N/A'}</p>
                <p style="margin:0;"><strong>Address:</strong> ${currentUser.address || 'N/A'}</p>
            `;
        }

        // 4. 精准提取被勾选的购物车商品详情
        const { data: items, error: itemsError } = await _supabase
            .from('cart_item')
            .select(`
                cart_item_id,
                quantity,
                structure_id,
                structure:structure_id (
                    structure_name, colour, price, image_url, material, stock,
                    furniture:furniture_id ( furniture_name )
                )
            `)
            .in('cart_item_id', checkoutCartItemIds); // 🌟 核心：只查用户打勾的那几个

        if (itemsError) throw itemsError;
        
        orderItemsData = items || [];
        
        // 渲染商品清单和价格
        renderOrderItems();

        // 5. 绑定支付按钮
        document.getElementById('btn-pay').onclick = processPayment;

    } catch (err) {
        console.error("Order Load Error:", err);
        alert("Failed to load checkout details.");
    }
}

// ----------------------------------------------------
// 🖼️ 渲染：生成商品确认列表和总价
// ----------------------------------------------------
function renderOrderItems() {
    const container = document.getElementById('order-items-container');
    container.innerHTML = '';
    finalTotalAmount = 0;

    orderItemsData.forEach(item => {
        const struct = item.structure || {};
        const furn = struct.furniture || {};
        
        const name = furn.furniture_name || 'Item';
        const price = Number(struct.price || 0);
        const qty = Number(item.quantity || 1);
        const subtotal = price * qty;
        
        finalTotalAmount += subtotal;

        const row = document.createElement('div');
        row.style.cssText = "display: flex; gap: 15px; align-items: center; border-bottom: 1px solid #f8fafc; padding-bottom: 15px;";
        
        row.innerHTML = `
            <img src="${struct.image_url || 'https://dzgtfwdqfqecetnfhcdi.supabase.co/storage/v1/object/public/furniture-images/ERROR%20PICTURE.png'}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid #f1f5f9;">
            <div style="flex-grow: 1;">
                <h4 style="margin: 0 0 5px 0; font-size: 16px; color: #1e2937;">${name}</h4>
                <p style="margin: 0; font-size: 13px; color: #64748b;">${struct.structure_name || ''} • ${struct.colour || ''}</p>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: bold; color: #1e2937;">RM ${subtotal.toFixed(2)}</div>
                <div style="font-size: 12px; color: #64748b;">RM ${price.toFixed(2)} x ${qty}</div>
            </div>
        `;
        container.appendChild(row);
    });

    document.getElementById('order-subtotal').innerText = `RM ${finalTotalAmount.toFixed(2)}`;
    document.getElementById('order-total').innerText = `RM ${finalTotalAmount.toFixed(2)}`;
}

// ----------------------------------------------------
// 💸 核心支付引擎：写订单、存快照、清购物车
// ----------------------------------------------------
async function processPayment() {
    const btnPay = document.getElementById('btn-pay');
    btnPay.disabled = true;
    btnPay.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Processing...';

    try {
        // 1. 生成唯一订单号 (ORD-时间戳)
        const newOrderId = 'ORD-' + Date.now();

        // 2. 写入订单主表 (orders)
        const { error: orderError } = await _supabase
            .from('orders')
            .insert([{ 
                order_id: newOrderId, 
                user_id: currentUser.id, 
                total_amount: finalTotalAmount, 
                status: 'order placed' // 你的数据库要求的状态
            }]);
            
        if (orderError) throw orderError;

        // 3. 构建订单明细并生成快照 (snapshot_info)
        const orderItemsToInsert = orderItemsData.map((item, index) => {
            const struct = item.structure || {};
            const furn = struct.furniture || {};
            
            // 构建快照，防止以后商家改图片、改价格导致历史订单变样
            const snapshot = {
                name: furn.furniture_name || 'Item',
                variant: struct.structure_name || 'Standard',
                colour: struct.colour || 'N/A',
                material: struct.material || 'N/A',
                image: struct.image_url || ''
            };

            const price = Number(struct.price || 0);
            const qty = Number(item.quantity || 1);

            return {
                order_item_id: `OITEM-${Date.now()}-${index}`,
                order_id: newOrderId,
                structure_id: item.structure_id,
                unit_price: price,
                quantity: qty,
                subtotal: price * qty,
                snapshot_info: snapshot // JSON 格式直接存入
            };
        });

        // 4. 批量写入订单明细表 (order_item)
        const { error: itemsInsertError } = await _supabase
            .from('order_item')
            .insert(orderItemsToInsert);
            
        if (itemsInsertError) throw itemsInsertError;

        // ... (前面的 1~4 步：生成订单、写 orders、写 order_item 保持不变) ...

        // 🌟 5. 核心新增：扣除实际库存 (Deduct Stock)
       // 🌟 5. 核心：扣除实时库存 (Deduct Live Stock)
        for (const item of orderItemsData) {
            const buyQty = Number(item.quantity || 1);

            // ① 当场去查这个款式最新的真实库存！(绝不依赖旧数据)
            const { data: liveStruct } = await _supabase
                .from('structure')
                .select('stock')
                .eq('structure_id', item.structure_id)
                .single();

            if (liveStruct) {
                const currentLiveStock = Number(liveStruct.stock || 0);
                const newStock = Math.max(0, currentLiveStock - buyQty);

                // ② 算出结果后，立刻写回数据库
                const { error: stockError } = await _supabase
                    .from('structure')
                    .update({ stock: newStock })
                    .eq('structure_id', item.structure_id);

                if (stockError) {
                    console.error(`Failed to deduct stock for ${item.structure_id}:`, stockError);
                } else {
                    console.log(`Stock for ${item.structure_id} updated: ${currentLiveStock} -> ${newStock}`);
                }
            }
        }

        // 6. 清空购物车里这些被结账的商品 (原本的第5步)
        const { error: cartDeleteError } = await _supabase
            .from('cart_item')
            .delete()
            .in('cart_item_id', checkoutCartItemIds);
            
        // ... (后面的成功反馈 保持不变) ...
            
        if (cartDeleteError) console.warn("Failed to clear cart items, but order was placed:", cartDeleteError);

        // 6. 成功反馈
        btnPay.style.background = "#2ecc71";
        btnPay.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 8px;"></i> Payment Successful!';
        
        // 延迟跳转 (假设你要跳回首页，或者以后如果有 Order History 就跳过去)
        setTimeout(() => {
            alert("Order placed successfully! Thank you for shopping with Ruma.");
            loadCustomerContent('home');
        }, 1500);

    } catch (error) {
        console.error("Payment Error:", error);
        alert("Payment failed. Please try again.");
        btnPay.disabled = false;
        btnPay.innerHTML = '<i class="fa-solid fa-credit-card" style="margin-right: 8px;"></i> Pay Now';
    }
}