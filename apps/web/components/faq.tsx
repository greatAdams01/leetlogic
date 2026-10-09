const questions = [
  [
    "Is it safe to buy on Leetlogic?",
    "Yes. Funds are protected and released according to delivery and quality confirmation.",
  ],
  [
    "Can I buy from outside Nigeria?",
    "Leetlogic supports international sourcing. Contact our team to discuss export-ready produce, documentation, and delivery to your destination.",
  ],
  [
    "What payment methods are accepted?",
    "Contact the team to confirm the Naira, USD, GBP, and EUR payment options available for your order.",
  ],
  [
    "How long does shipping usually take?",
    "Delivery depends on the produce, destination, and transport method. Our team can confirm a delivery estimate when you arrange your order.",
  ],
  [
    "Are there any customs fees I should be aware of?",
    "International orders may attract duties and customs fees in the destination country. Ask the sourcing team for the applicable charges before placing an order.",
  ],
  [
    "Do you offer customer support for international buyers?",
    "Yes. Email info@leetlogic.com or use our contact form to discuss international sourcing and logistics.",
  ],
];
export function Faq() {
  return (
    <div className="faq-list" id="faq">
      {questions.map(([question, answer], index) => (
        <details key={question} open={index === 0}>
          <summary>
            {question}
            <span aria-hidden="true" />
          </summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}
