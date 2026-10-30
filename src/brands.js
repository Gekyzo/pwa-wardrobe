// The brands that the brand field suggests: the brands of the wardrobe first, then a seed list
// of known clothing brands (data).
export const BRANDS = [
  'Abercrombie & Fitch', 'Acne Studios', 'Adidas', 'Adolfo Domínguez', 'Aldo', 'American Eagle',
  'American Vintage', 'Anthropologie', 'Arket', 'Armani', 'Asics', 'ASOS', 'Balenciaga', 'Balmain',
  'Banana Republic', 'Barbour', 'Bershka', 'Birkenstock', 'Blundstone', 'Boggi Milano', 'Bottega Veneta',
  'Brooks Brothers', 'Burberry', 'Calvin Klein', 'Calzedonia', 'Camper', 'Carhartt', 'Celine', 'Champion',
  'Chanel', 'Columbia', 'Converse', 'COS', 'Crocs', 'Decathlon', 'Desigual',
  'Diesel', 'Dior', 'Dr. Martens', 'Ecoalf', 'El Corte Inglés', 'Ellesse', 'Esprit', 'Fila',
  'Fred Perry', 'Gant', 'Gap', 'Gucci', 'Hackett', 'Hawkers', 'Helly Hansen', 'Hermès', 'H&M',
  'Hollister', 'Hoka', 'Hugo Boss', 'Intimissimi', 'Jack & Jones', 'J.Crew', 'Kappa', 'Kiabi',
  'Lacoste', "Levi's", 'Loewe', 'Louis Vuitton', 'Lululemon', 'Mango', 'Marc O\'Polo', 'Massimo Dutti',
  'Merrell', 'Michael Kors', 'Miu Miu', 'Moncler', 'Muji', 'Napapijri', 'New Balance', 'Nike', 'Oysho',
  'Pepe Jeans', 'Polo Ralph Lauren', 'Prada', 'Primark', 'Puma', 'Pull&Bear', 'Quiksilver', 'Ralph Lauren',
  'Reebok', 'Reserved', 'Saint Laurent', 'Salomon', 'Scalpers', 'Sfera', 'Shein', 'Skechers',
  'Springfield', 'Stradivarius', 'Superdry', 'Ted Baker', 'The North Face', 'Timberland', 'Tod\'s',
  'Tommy Hilfiger', 'Uniqlo', 'Uterqüe', 'Valentino', 'Vans', 'Versace', 'Victoria', 'Wrangler', 'Zadig & Voltaire', 'Zara', 'Zegna',
];

const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// The brands that start with `text` (case and accents aside), the brands of `mine` first in their
// order, then the seed brands that `mine` does not hold. An empty text suggests nothing.
export const suggestBrands = (mine, text, seed = BRANDS) => {
  const start = fold(text.trim());
  if (!start) return [];
  const taken = new Set(mine.map(fold));
  return [
    ...mine.filter((brand) => fold(brand).startsWith(start)),
    ...seed.filter((brand) => !taken.has(fold(brand)) && fold(brand).startsWith(start)),
  ];
};
