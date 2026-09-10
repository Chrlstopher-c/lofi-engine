// Gamme mineure naturelle : la tierce, la sixte et la septième descendent d'un demi-ton.
// C'est tout ce qui sépare le clair du sombre.
export const minorSingleOct = [0, 2, 3, 5, 7, 8, 10];
export const minorDoubleOct = [...minorSingleOct, ...minorSingleOct.map((n) => n + 12)];
// Même découpe que la gamme majeure : de la quinte en dessous à la quinte au-dessus,
// dix-sept degrés sur lesquels la mélodie se promène.
export const minorFiveToFive = [
  ...minorSingleOct.map((n) => n - 12).slice(4),
  ...minorSingleOct,
  ...minorSingleOct.map((n) => n + 12).slice(0, 5),
];
