"use client";
import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";

export function ContactForm() {
  return (
    <Suspense
      fallback={
        <div
          className="contact-form"
          style={{ minHeight: 664 }}
          aria-label="Loading contact form"
        />
      }
    >
      <ContactFormFields />
    </Suspense>
  );
}

function ContactFormFields() {
  const params = useSearchParams();
  const [inquiry, setInquiry] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState("");
  useEffect(() => {
    const value = params.get("inquiry");
    setInquiry(value && ["selling", "buying", "careers", "support"].includes(value) ? value : "");
    const category = params.get("category");
    setMessage(category ? `I am interested in ${category.toLowerCase()}.` : "");
    setDraft("");
  }, [params]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const body = `Name: ${values.get("name")}\nEmail: ${values.get("email")}\nPhone: ${values.get("phone")}\n\n${message}`;
    setDraft(
      `mailto:info@leetlogic.com?subject=${encodeURIComponent(`Leetlogic ${inquiry} inquiry`)}&body=${encodeURIComponent(body)}`,
    );
  }
  return (
    <form className="contact-form" onSubmit={submit} onChange={() => setDraft("")}>
      <label>
        Full name
        <input
          name="name"
          autoComplete="name"
          placeholder="Amadi Nwachukwu"
          required
          maxLength={100}
        />
      </label>
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="amadi@example.com"
          required
          maxLength={254}
        />
      </label>
      <label>
        Phone number
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+234 803 123 4567"
          maxLength={30}
        />
      </label>
      <label>
        How can we help?
        <select
          name="inquiry"
          value={inquiry}
          onChange={(e) => {
            setInquiry(e.target.value);
            setDraft("");
          }}
          required
        >
          <option value="" disabled>
            Select team member
          </option>
          <option value="selling">Farmer support — sell produce</option>
          <option value="buying">Buyer partnerships — source produce</option>
          <option value="support">Logistics and general support</option>
          <option value="careers">Careers and community partnerships</option>
        </select>
      </label>
      <label>
        Message
        <textarea
          name="message"
          placeholder="Enter a description..."
          required
          maxLength={5000}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setDraft("");
          }}
        />
      </label>
      <button type="submit" className="cta dark">
        Submit inquiry
        <span>
          <img src="/figma/a24c2.svg" alt="" />
        </span>
      </button>
      {draft && (
        <div className="form-result" role="status">
          <p>Your inquiry is ready. Open your email app to review and send it to our team.</p>
          <a href={draft}>Open email draft ↗</a>
        </div>
      )}
    </form>
  );
}
