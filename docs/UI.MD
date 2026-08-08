# UI Reference & Design Patterns

> Single source of truth for reusable UI design patterns used across the
> WebSmith platform. CSS implementations live in `app/globals.css`
> (scoped, prefixed with `uv-` to avoid collisions with the existing design
> system). Every pattern below is a visual reference from
> [Uiverse.io](https://uiverse.io).

---

## 1. Button Design

Use the following pattern as the visual reference for primary and important actions.

```css
/* Button reference — Uiverse.io by Navarog21 */

button {
  width: 10em;
  position: relative;
  height: 3.5em;
  border: 3px ridge #149CEA;
  outline: none;
  background-color: transparent;
  color: white;
  transition: 1s;
  border-radius: 0.3em;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
}

button::after {
  content: "";
  position: absolute;
  top: -10px;
  left: 3%;
  width: 95%;
  height: 40%;
  background-color: #212121;
  transition: 0.5s;
  transform-origin: center;
}

button::before {
  content: "";
  transform-origin: center;
  position: absolute;
  top: 80%;
  left: 3%;
  width: 95%;
  height: 40%;
  background-color: #212121;
  transition: 0.5s;
}

button:hover::before,
button:hover::after {
  transform: scale(0);
}

button:hover {
  box-shadow: inset 0px 0px 25px #1479EA;
}
```

---

## 2. Textbox / Input Design

Use this pattern as the visual reference.

```css
/* Input reference — Uiverse.io by alexruix */

.input {
  max-width: 190px;
  height: 44px;
  background-color: #05060f0a;
  border-radius: .5rem;
  padding: 0 1rem;
  border: 2px solid transparent;
  font-size: 1rem;
  transition:
    border-color .3s cubic-bezier(.25,.01,.25,1) 0s,
    color .3s cubic-bezier(.25,.01,.25,1) 0s,
    background .2s cubic-bezier(.25,.01,.25,1) 0s;
}

.label {
  display: block;
  margin-bottom: .3rem;
  font-size: .9rem;
  font-weight: bold;
  color: #05060f99;
  transition: color .3s cubic-bezier(.25,.01,.25,1) 0s;
}

.input:hover,
.input:focus,
.input-group:hover .input {
  outline: none;
  border-color: #05060f;
}

.input-group:hover .label,
.input:focus {
  color: #05060fc2;
}
```

---

## 3. Card Design

Use this as the visual reference.

```html
<!-- Card reference — Uiverse.io by 05akalan57 -->

<div
  class="relative drop-shadow-xl w-48 h-64 overflow-hidden rounded-xl bg-[#3d3c3d]"
>
  <div
    class="absolute flex items-center justify-center text-white z-[1] opacity-90 rounded-xl inset-0.5 bg-[#323132]"
  >
    CARD
  </div>

  <div
    class="absolute w-56 h-48 bg-white blur-[50px] -left-1/2 -top-1/2"
  ></div>
</div>
```

---

## 4. Form Design

Use this pattern as the visual reference.

```css
/* Form reference — Uiverse.io by Smit-Prajapati */

.container {
  max-width: 350px;
  background: #F8F9FD;
  background: linear-gradient(
    0deg,
    rgb(255, 255, 255) 0%,
    rgb(244, 247, 251) 100%
  );
  border-radius: 40px;
  padding: 25px 35px;
  border: 5px solid rgb(255, 255, 255);
  box-shadow:
    rgba(133, 189, 215, 0.8784313725)
    0px 30px 30px -20px;
  margin: 20px;
}

.heading {
  text-align: center;
  font-weight: 900;
  font-size: 30px;
  color: rgb(16, 137, 211);
}

.form {
  margin-top: 20px;
}

.form .input {
  width: 100%;
  background: white;
  border: none;
  padding: 15px 20px;
  border-radius: 20px;
  margin-top: 15px;
  box-shadow: #cff0ff 0px 10px 10px -5px;
  border-inline: 2px solid transparent;
}

.form .input:focus {
  outline: none;
  border-inline: 2px solid #12B1D1;
}

.form .login-button {
  display: block;
  width: 100%;
  font-weight: bold;
  background: linear-gradient(
    45deg,
    rgb(16, 137, 211) 0%,
    rgb(18, 177, 209) 100%
  );
  color: white;
  padding-block: 15px;
  margin: 20px auto;
  border-radius: 20px;
  border: none;
  transition: all 0.2s ease-in-out;
}

.form .login-button:hover {
  transform: scale(1.03);
}

.form .login-button:active {
  transform: scale(0.95);
}
```

---

## CSS Implementation Notes

- The reference styles target bare `button`, `.input`, `.label`, `.container`
  selectors. In `app/globals.css` these are re-published under the `uv-*`
  prefix (e.g. `uv-button`, `uv-input`, `uv-form`) so they never clobber the
  existing component styles.
- Card (section 3) is HTML/Tailwind-first; the equivalent `.uv-card` class in
  globals.css reproduces the layered, glowing-border card with plain CSS.
- Reduced motion is honored in `globals.css` via
  `@media (prefers-reduced-motion: reduce)`.
