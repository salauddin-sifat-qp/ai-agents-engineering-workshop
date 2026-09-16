const slides = document.querySelectorAll(".slide");
const progress = document.getElementById("progress");
const counter = document.getElementById("counter");

let current = 0;

function show(index) {
  slides[current].classList.remove("active");
  current = (index + slides.length) % slides.length;
  slides[current].classList.add("active");
  counter.textContent = `${current + 1} / ${slides.length}`;
  progress.style.width = `${((current + 1) / slides.length) * 100}%`;
}

document
  .getElementById("next")
  .addEventListener("click", () => show(current + 1));
document
  .getElementById("prev")
  .addEventListener("click", () => show(current - 1));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === " ") {
    event.preventDefault();
    show(current + 1);
  }
  if (event.key === "ArrowLeft") show(current - 1);
  if (event.key === "Home") show(0);
  if (event.key === "End") show(slides.length - 1);
});

show(0);
