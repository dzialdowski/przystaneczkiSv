export interface DemoStop {
	id: string;
	name: string;
	region: string;
	courses: number;
	linesCount: number;
}

/**
 * Top 20 najważniejszych przystanków i węzłów przesiadkowych sieci ZDiZ Gdynia.
 * Wyselekcjonowane pod kątem:
 * - maksymalnej liczby kursów i obsługiwanych linii,
 * - zróżnicowania geograficznego (różne dzielnice i miejscowości aglomeracji),
 * - różnorodności obsługiwanych korytarzy i linii (autobusowe, trolejbusowe, pospieszne, nocne).
 */
export const DEMO_STOPS: DemoStop[] = [
	{
		id: '35111',
		name: 'Wzgórze Św. Maksymiliana SKM 01',
		region: 'Wzgórze Św. Maksymiliana',
		courses: 1689,
		linesCount: 21
	},
	{
		id: '39440',
		name: 'Obłuże Centrum 01',
		region: 'Obłuże',
		courses: 1486,
		linesCount: 26
	},
	{
		id: '37410',
		name: 'Morska - Estakada 01',
		region: 'Grabówek / Estakada',
		courses: 1427,
		linesCount: 22
	},
	{
		id: '35040',
		name: 'Redłowo SKM - Park Technologiczny 02',
		region: 'Redłowo / PPNT',
		courses: 1210,
		linesCount: 19
	},
	{
		id: '33190',
		name: 'Karwiny PKM 01',
		region: 'Karwiny',
		courses: 1145,
		linesCount: 18
	},
	{
		id: '36150',
		name: 'Gdynia Dworzec Gł. PKP - Hala 06',
		region: 'Śródmieście / Dworzec Gł.',
		courses: 1114,
		linesCount: 16
	},
	{
		id: '33030',
		name: 'Plac Górnośląski 02',
		region: 'Mały Kack / Wielkopolska',
		courses: 964,
		linesCount: 16
	},
	{
		id: '32470',
		name: 'Dąbrowa Centrum 01',
		region: 'Dąbrowa',
		courses: 939,
		linesCount: 16
	},
	{
		id: '30139',
		name: 'Witomino Centrum 01',
		region: 'Witomino',
		courses: 692,
		linesCount: 12
	},
	{
		id: '37380',
		name: 'Chylonia Centrum 01',
		region: 'Chylonia',
		courses: 668,
		linesCount: 8
	},
	{
		id: '40294',
		name: 'Kacze Buki 01',
		region: 'Kacze Buki / Południe',
		courses: 632,
		linesCount: 13
	},
	{
		id: '31016',
		name: 'Pogórze Górne 01',
		region: 'Pogórze',
		courses: 630,
		linesCount: 16
	},
	{
		id: '34190',
		name: 'Malczewskiego 02',
		region: 'Sopot',
		courses: 521,
		linesCount: 10
	},
	{
		id: '40076',
		name: 'Filipkowskiego 02',
		region: 'Chwarzno-Wiczlino',
		courses: 518,
		linesCount: 8
	},
	{
		id: '37340',
		name: 'Cisowa Sibeliusa 01',
		region: 'Cisowa',
		courses: 428,
		linesCount: 6
	},
	{
		id: '33280',
		name: 'Orłowo SKM - Orłowska 02',
		region: 'Orłowo',
		courses: 385,
		linesCount: 6
	},
	{
		id: '39160',
		name: 'Oksywie Górne 02',
		region: 'Oksywie',
		courses: 364,
		linesCount: 8
	},
	{
		id: '31144',
		name: 'Kosakowo - Urząd Gminy 01',
		region: 'Kosakowo',
		courses: 245,
		linesCount: 8
	},
	{
		id: '31261',
		name: 'Rumia Dworzec PKP 01',
		region: 'Rumia',
		courses: 161,
		linesCount: 2
	},
	{
		id: '39250',
		name: 'Babie Doły 01',
		region: 'Babie Doły',
		courses: 153,
		linesCount: 5
	}
];
