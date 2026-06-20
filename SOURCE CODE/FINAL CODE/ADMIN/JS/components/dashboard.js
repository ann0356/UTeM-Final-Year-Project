import { _supabase } from '../../../SUPABASE/supabase_admin_conn.js';

let salesChartInstance = null;
let categoryChartInstance = null;

export async function initDashboard() {
    console.log("Dashboard loading real data...");

    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');

    // 1. 初始加载数据
    await loadDashboardData(yearSelect.value, monthSelect.value);

    // 2. 监听下拉框改变事件
    yearSelect.addEventListener('change', async (e) => {
        await loadDashboardData(e.target.value, monthSelect.value);
    });

    monthSelect.addEventListener('change', async (e) => {
        await loadDashboardData(yearSelect.value, e.target.value);
    });

    // 3. 导出 PDF 功能 (隐身控制栏、坐标归零、横向导出)
    document.getElementById('export-report-btn').addEventListener('click', () => {
        const element = document.querySelector('.dashboard-page');
        const headerArea = document.querySelector('.page-header');
        
        // 截图前：暂时隐藏控制栏
        if (headerArea) headerArea.style.display = 'none';

        html2pdf().set({
            margin: [10, 0, 10, 0], // 四周留白 10mm
            filename: `Report_${yearSelect.value}_${monthSelect.value}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { 
                scale: 2, 
                scrollX: 0, 
                scrollY: 0, 
                useCORS: true 
            }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        }).from(element).save().then(() => {
            // 截图后：立刻恢复控制栏显示
            if (headerArea) headerArea.style.display = 'flex';
        });
    });
}

// 📅 辅助函数：生成数据库查询所需的起止时间
function getDateRange(year, month) {
    let startDate, endDate;
    if (month === 'all') {
        startDate = `${year}-01-01T00:00:00.000Z`;
        endDate = `${year}-12-31T23:59:59.999Z`;
    } else {
        startDate = `${year}-${month}-01T00:00:00.000Z`;
        const lastDay = new Date(year, parseInt(month), 0).getDate();
        endDate = `${year}-${month}-${lastDay}T23:59:59.999Z`;
    }
    return { startDate, endDate };
}

// 🚀 核心派发器：从数据库抓取数据
async function loadDashboardData(year, month) {
    console.log(`Fetching data from database for ${year}, ${month === 'all' ? 'All Year' : 'Month ' + month}...`);
    const { startDate, endDate } = getDateRange(year, month);

    try {
        // --- 查询 1：获取时间段内的所有订单 (务必查询 status) ---
        const { data: ordersData, error: orderErr } = await _supabase
            .from('orders') 
            .select('order_id, total_amount, created_at, status')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (orderErr) throw orderErr;
        const validOrders = ordersData || [];
        const orderIds = validOrders.map(o => o.order_id);

        // --- 查询 2：获取新增用户数 ---
        const { count: usersCount, error: userErr } = await _supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true }) 
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (userErr) throw userErr;

        // --- 查询 3：获取订单明细联表数据 ---
        let orderItems = [];
        if (orderIds.length > 0) {
            const { data: itemsData, error: itemsErr } = await _supabase
                .from('order_item')
                .select(`
                    order_id,
                    quantity,
                    structure (
                        furniture (
                            furniture_name,
                            type (
                                category (
                                    category_name
                                )
                            )
                        )
                    )
                `)
                .in('order_id', orderIds); 
            
            if (itemsErr) throw itemsErr;
            orderItems = itemsData || [];
        }

        // 把真实数据交给渲染函数
        updateKPIs(validOrders, usersCount || 0, orderItems);
        renderCharts(validOrders, orderItems, year, month);

    } catch (error) {
        console.error("Error fetching data from database:", error);
        alert("Failed to fetch data. Please check your database connection or table names!");
    }
}

// 📊 更新顶部 KPI 卡片
function updateKPIs(orders, usersCount, orderItems) {
    // 🌟 核心：统一筛选已送达的订单
    const deliveredOrders = orders.filter(o => o.status && o.status.toLowerCase() === 'delivered');
    const deliveredOrderIds = deliveredOrders.map(o => o.order_id);
    const deliveredItems = orderItems.filter(item => deliveredOrderIds.includes(item.order_id));

    // 1. Total Revenue (仅算送达)
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    document.getElementById('kpi-revenue').innerText = `RM ${totalRevenue.toFixed(2)}`;

    // 2. Total Orders (仅算送达)
    document.getElementById('kpi-orders').innerText = `${deliveredOrders.length} Orders`;

    // 3. New Users
    document.getElementById('kpi-users').innerText = `+${usersCount} Users`;

    // 4. 最热销产品 (仅算送达)
    const productSales = {};
    deliveredItems.forEach(item => {
        const fName = item.structure?.furniture?.furniture_name;
        if (fName) {
            productSales[fName] = (productSales[fName] || 0) + Number(item.quantity);
        }
    });

    let hotProduct = "No Data";
    let maxQty = 0;
    for (const [name, qty] of Object.entries(productSales)) {
        if (qty > maxQty) {
            maxQty = qty;
            hotProduct = name;
        }
    }
    document.getElementById('kpi-hot-product').innerText = hotProduct;
}

// 📈 渲染图表
function renderCharts(orders, orderItems, year, month) {
    // 销毁旧实例防止重叠
    if (salesChartInstance) salesChartInstance.destroy();
    if (categoryChartInstance) categoryChartInstance.destroy();

    // 🌟 全局过滤已送达的数据
    const deliveredOrders = orders.filter(o => o.status && o.status.toLowerCase() === 'delivered');
    const deliveredOrderIds = deliveredOrders.map(o => o.order_id);
    const deliveredItems = orderItems.filter(item => deliveredOrderIds.includes(item.order_id));

    // ==========================================
    // 1. 左侧：销售趋势线形图
    // ==========================================
    let salesLabels = [];
    let salesData = [];

    if (month === 'all') {
        salesLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        salesData = new Array(12).fill(0);
        deliveredOrders.forEach(o => {
            const m = new Date(o.created_at).getMonth(); 
            salesData[m] += Number(o.total_amount);
        });
    } else {
        const daysInMonth = new Date(year, parseInt(month), 0).getDate();
        salesLabels = Array.from({length: daysInMonth}, (_, i) => `Day ${i+1}`);
        salesData = new Array(daysInMonth).fill(0);
        deliveredOrders.forEach(o => {
            const d = new Date(o.created_at).getDate() - 1; 
            salesData[d] += Number(o.total_amount);
        });
    }

    const ctxSales = document.getElementById('salesChart').getContext('2d');
    salesChartInstance = new Chart(ctxSales, {
        type: 'line',
        data: {
            labels: salesLabels,
            datasets: [{
                label: `Delivered Sales (RM) - ${year} ${month === 'all' ? '(All Year)' : '(Month ' + month + ')'}`,
                data: salesData,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                tension: 0.3, fill: true
            }]
        },
        options: { responsive: true }
    });

    // ==========================================
    // 2. 右侧：分类圆饼图 (带有动态颜色和标签)
    // ==========================================
    const categorySales = {};
    deliveredItems.forEach(item => {
        const cName = item.structure?.furniture?.type?.category?.category_name;
        if (cName) {
            categorySales[cName] = (categorySales[cName] || 0) + Number(item.quantity);
        }
    });

    const catLabels = Object.keys(categorySales);
    const catData = Object.values(categorySales);

    if (catLabels.length === 0) {
        catLabels.push('No Sales');
        catData.push(1); 
    }

    // 动态生成和谐饱满的 HSL 颜色
    function generateDynamicColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 137.5) % 360; 
            colors.push(`hsl(${hue}, 75%, 55%)`);
        }
        return colors;
    }

    const dynamicBgColors = generateDynamicColors(catLabels.length);
    const ctxCategory = document.getElementById('categoryChart').getContext('2d');
    
    categoryChartInstance = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: catLabels,
            datasets: [{
                data: catData, 
                backgroundColor: dynamicBgColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        // 🌟 启用数据标签插件
        plugins: [ChartDataLabels], 
        options: { 
            responsive: true,
            plugins: {
                datalabels: {
                    color: '#ffffff', 
                    font: { weight: 'bold', size: 11 },
                    textAlign: 'center', 
                    formatter: (value, context) => {
                        // 如果是没数据的占位符，不显示文字
                        if (context.chart.data.labels[0] === 'No Sales') return '';
                        const labelName = context.chart.data.labels[context.dataIndex];
                        return labelName + '\n' + value;
                    }
                }
            }
        }
    });
}