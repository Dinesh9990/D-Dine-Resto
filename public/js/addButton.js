document.addEventListener("DOMContentLoaded", function () {

    const viewCart = document.querySelector(".view-cart");
    const itemNums = document.querySelector(".item-nums");
    let totalItems = 0;

    const currentPath = window.location.pathname;

    if (currentPath.includes("viewCart")) {
        if (viewCart) {
            viewCart.classList.add("hidden");
        }
        return;
    }

   async function updateItemNums() {
        if(!itemNums || !viewCart) return;

       try {
        const response = await fetch("/cartCount");
        const data = await response.json();

        totalItems = data.totalItems;
       }
       catch(err) {
        console.log(err);
        return;
       }

        if(totalItems > 0) {
            itemNums.textContent = `${totalItems} item(s) added`;
            viewCart.classList.remove("hidden");
            sessionStorage.setItem("cartActive", "true");
        }
        else {
            viewCart.classList.add("hidden");
            sessionStorage.setItem("cartActive", "false")
        }
    }

    attachAddButtonListener();

    function attachCounterListeners(counterDiv) {
        const quantitySpan = counterDiv.querySelector(".quantity");
        const incrementBtn = counterDiv.querySelector(".increment");
        const decrementBtn = counterDiv.querySelector(".decrement");

        const parentCard = counterDiv.closest(".item-card");
        const itemId = parentCard.dataset.id;

        incrementBtn.addEventListener("click", async() => {
            let currentQuantity = parseInt(quantitySpan.textContent, 10);
            quantitySpan.textContent = currentQuantity + 1;
            totalItems++;

            await updateSession(itemId, currentQuantity + 1);
            updateItemNums(); 
        });

        decrementBtn.addEventListener("click", async () => {
            let currentQuantity = parseInt(quantitySpan.textContent, 10);

            if(currentQuantity > 1) {
                quantitySpan.textContent = currentQuantity - 1;
                totalItems--;

                await updateSession(itemId, currentQuantity - 1);
                updateItemNums();
            }
            else {
                const parentContainer = counterDiv.parentElement;
                const img = parentContainer.querySelector("img");
                parentContainer.innerHTML = `
                   <img src="${img.src}" alt="${img.alt}" />
                    <button class="btn add-btn">ADD</button>
                `;
                attachAddButtonListener();

                await updateSession(itemId, 0);
                updateItemNums();
                
                if(totalItems === 0) {
                    viewCart.classList.add("hidden");
                }

            }
        });
    }

   async function updateSession(id, quantity) {
        try {
            const response = await fetch("/session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ id, quantity }),
            });
            const data = await response.json();
            console.log("Session updated:", data);
        } catch (error) {
            console.error("Error updating session:", error);
        }
    }

    function attachAddButtonListener() {
        let buttons = document.querySelectorAll(".add-btn");

        buttons.forEach((btn) => {
            btn.addEventListener("click", async () => {


                const parentContainer = btn.parentElement;
                const img = parentContainer.querySelector("img");
                const parentCard = btn.closest(".item-card");
                const itemId = parentCard.dataset.id;
                await updateSession(itemId, 1);
                updateItemNums(); 


                parentContainer.innerHTML = `
                    <img src="${img.src}" alt="${img.alt}" />
                    <div class="counter">
                        <button class="decrement">-</button>
                        <span class="quantity">1</span>
                        <button class="increment">+</button>
                    </div>
                `;

                const newCounter = parentContainer.querySelector(".counter");
                attachCounterListeners(newCounter);

            });
        });
    }
    updateItemNums();

});
