import { _supabase } from '../../SUPABASE/supabase_admin_conn.js';
import { initDashboard } from './components/dashboard.js';
import { initProducts } from './components/products.js';
import { initAdminOrder } from './components/orders.js'; 
import { initFeedback } from './components/feedback.js';

const mainContent = document.getElementById('main-content');

// ==========================================
// 🛡️ 1. 路由守卫：检查身份验证
// ==========================================
async function checkAuth() {
    try {
        const { data: { session }, error: sessionError } = await _supabase.auth.getSession();

        if (sessionError || !session) {
            window.location.href = 'admin_login.html'; 
            return;
        }

        const userId = session.user.id;

        const { data: profileData, error: profileError } = await _supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profileError || !profileData || profileData.role !== 'superadmin') {
            await _supabase.auth.signOut(); 
            alert("Access Denied: You do not have administrator privileges.");
            window.location.href = 'admin_login.html';
            return;
        }

        // D. 身份完全合法！揭开黑布（恢复显示）
        document.body.style.display = 'flex'; 
        
        // 🌟 记忆功能 1：读取缓存的页面，如果没有（第一次登入）就默认进 dashboard
        const savedPage = localStorage.getItem('admin_current_page') || 'dashboard';
        loadContent(savedPage);

        // 🌟 记忆功能 2：自动帮你把侧边栏的高亮光标移到对应的按钮上
        document.querySelectorAll('.menu-item').forEach(el => {
            el.classList.remove('active');
            if (el.getAttribute('data-page') === savedPage) {
                el.classList.add('active');
            }
        });

    } catch (error) {
        console.error("身份验证过程中出错:", error);
        window.location.href = 'admin_login.html';
    }
}

// ==========================================
// ⚙️ 2. 内容加载与切换逻辑
// ==========================================
async function loadContent(pageName) {
    try {
        // 🌟 记忆功能 3：每次成功进入新页面，都把页面名字存入本地缓存
        localStorage.setItem('admin_current_page', pageName);

        mainContent.innerHTML = "<p style='padding:20px;'>加载中...</p>"; 
        
        const response = await fetch(`../HTML/components/${pageName}.html`);
        if (!response.ok) throw new Error("页面加载失败");
        
        const html = await response.text();
        mainContent.innerHTML = html;

        if (pageName === 'dashboard') {
            await initDashboard(); 
        } else if (pageName === 'products') {
            await initProducts(); 
        } else if (pageName === 'orders') {
            await initAdminOrder();
        }else if (pageName === 'customer_feedback') {
            await initFeedback();
        }

    } catch (error) {
        console.error(error);
        mainContent.innerHTML = "<h2>Failed to load, please try again.</h2>";
    }
}

// ==========================================
// 🖱️ 3. 事件监听器绑定
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        this.classList.add('active');
        
        const pageId = this.getAttribute('data-page');
        loadContent(pageId); 
    });
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        // 🌟 记忆功能 4：退出登录时，清空页面记忆，确保下次登录时从 dashboard 开始
        localStorage.removeItem('admin_current_page');
        
        await _supabase.auth.signOut();
        window.location.href = 'admin_login.html';
    });
}