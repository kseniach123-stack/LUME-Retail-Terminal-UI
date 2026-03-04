 const LumeTerminal = {state: {
        inventory: [
            { id: 1, name: "Eau de toilette", price: 160.00, img: "https://images.unsplash.com/photo-1606334585230-3ba76447cdbd?q=80&w=863&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
            { id: 2, name: "Cream Set", price: 115.00, img: "https://images.unsplash.com/photo-1647492989217-afaf693e19b8?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
            { id: 3, name: "Body Oil", price: 45.00, img: "https://images.unsplash.com/photo-1532413992378-f169ac26fff0?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" },
            { id: 4, name: "Lipstick", price: 31.00, img: "https://images.unsplash.com/photo-1671575212918-0af5f840997a?q=80&w=880&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" }
        ],
        cart: [],
        sales: JSON.parse(localStorage.getItem('lume_vault')) || [],
        sessionItems: 0
    },
    actions: {},
};
    document.addEventListener('DOMContentLoaded', () => {
    if(LumeTerminal.ui) LumeTerminal.ui.init();
});
