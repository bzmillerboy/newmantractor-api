const {
  E_EMPHASYS_API_KEY,
  SANITY_TOKEN_ETL,
  SANITY_PROJECT_ID,
  SANITY_DATASET,
  SANITY_API_VERSION,
  E_EMPHASYS_API_USERNAME,
  E_EMPHASYS_API_PASSWORD,
  GOOGLE_MAPS_API_KEY,
  SALES_FALLBACK_FL,
  SALES_FALLBACK_KY,
  SALES_FALLBACK,
  RENTAL_FALLBACK,
  TERRITORIES_FILE,
} = process.env;
// const fetch = require("node-fetch");
const fetch = require("node-fetch-retry");
const { v4: uuidv4 } = require("uuid");
const base64 = require("base-64");
const sanityClient = require("@sanity/client");
const client = sanityClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  token: SANITY_TOKEN_ETL,
  useCdn: false,
  apiVersion: SANITY_API_VERSION,
});
console.log("Sanity Dataset:", SANITY_DATASET);
const photoData = require("../data/photos.json");
const got = require("got");
const stream = require("stream");
const erpSampleData = require("../data/sample-erp-data.json");
const { eq } = require("lodash");
const { Client } = require("@googlemaps/google-maps-services-js");
const geoClient = new Client({});
const territoriesProd = require(`../data/territories.json`);
const territoriesDev = require(`../data/territories-dev.json`);

// const fs = require('fs')

//TODO: move these back to their functions since I'm replicating in createEquipment || figure out how to append the new item after it gets created
let currentCategories;
let currentMakes;
let currentModels;
let currentLocations;

const toTitleCase = (str) =>
  str
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");

const formatPhoneNumber = (number) => {
  if (number) {
    const formatPhoneNumber = (str) => {
      const removeCountryCode = str.slice(-10);

      //Filter only numbers from the input
      const cleaned = ("" + removeCountryCode).replace(/\D/g, "");

      //Check if the input is of correct length
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);

      if (match) {
        return "(" + match[1] + ") " + match[2] + "-" + match[3];
      }
    };

    return formatPhoneNumber(number);
  }

  return null;
};

const fetchEquipmentInventory = async (pageNo, pageSize) => {
  const start = pageSize * pageNo - pageSize;
  const end = pageSize * pageNo - 1;
  console.log(`fetching from ${start} to ${end}`);
  currentInventory = await client.fetch(
    `*[_type == "inventory" && !(_id in path("drafts.**")) && !defined(imageGallery.images)] | order(_id asc) [${start}..${end}] {_id, title, serial, mainImage, imageGallery}`
  );
  return currentInventory;
};

const fetchEquipmentInventory2 = async (start, end) => {
  console.log(`fetching from ${start} to ${end}`);
  currentInventory = await client.fetch(
    `*[_type == "inventory" && !(_id in path("drafts.**"))][${start}..${end}]{_id, slug, equipmentCategories->{slug} }`
  );
  return currentInventory;
};

const fetchEquipmentPhotos = async (equipment) => {
  return equipment.flatMap((e, i) => {
    const imageGallerySource = photoData.flatMap((p) => {
      if (
        p.serial === `NT${e.serial.toLowerCase()}` ||
        p.serial === `nt${e.serial.toLowerCase()}`
      ) {
        return {
          sequence: p.sequence,
          url: `http://newmantractor-amazons3.imgix.net/extra_large/${p.file_name}?auto=compress&vib=18&sharp=18`,
        };
      } else {
        return [];
      }
    });

    if (imageGallerySource.length > 0) {
      return {
        ...e,
        mainImage: `http://newmantractor-amazons3.imgix.net/extra_large/NT${e.serial}-1.${e.extension}?auto=compress&vib=18&sharp=18`,
        images: imageGallerySource,
      };
    } else {
      return [];
    }
  });
};

const createAsset = async (imageURL, id) => {
  console.log(`createAsset ran: ${id} | ${imageURL}`);
  const asset = await client.assets
    .upload("image", got.stream(imageURL), { filename: `${id}-1.jpg` })
    .catch((error) => console.error(`Sanity client.assets failed: ${error}`));
  return asset;
};

const loopIgArr = async (ep) => {
  //sort ep.images by url
  const epImagesSorted = await ep.images.sort(function (a, b) {
    return a.sequence - b.sequence;
  });

  const iGArr = await Promise.all(
    epImagesSorted.map(async (ig) => {
      const doc = await createAsset(ig.url, ep._id);
      console.log(
        "This is your asset doc:\n",
        JSON.stringify(doc._id, null, 2)
      );
      return {
        _type: "image",
        _key: uuidv4(),
        asset: {
          _type: "reference",
          _ref: doc._id,
        },
      };
    })
  );
  return iGArr;
};

const uploadImages = async (equipmentPhotos) => {
  const wait = (timeToDelay) =>
    new Promise((resolve) => setTimeout(resolve, timeToDelay));
  let photos = [];
  for (var counter = 1; counter < equipmentPhotos.length; counter++) {
    await wait(0.1);
    const iGArr = await loopIgArr(equipmentPhotos[counter]);
    photos.push({
      ...equipmentPhotos[counter],
      mainImage: iGArr[0].asset._ref,
      imageGallery: iGArr,
    });
  }
  return photos;
};

const addInventoryPhotos = async (imageAssets) => {
  const createTransaction = (imageAssetsArr) =>
    imageAssetsArr.reduce((tx, ia) => {
      console.log("adding image to Sanity", ia._id);
      return tx.patch(ia._id, (p) =>
        p.set({
          mainImage: {
            _type: "mainImage",
            asset: {
              _type: "reference",
              _ref: ia.mainImage,
            },
          },
          imageGallery: {
            _type: "imageGallery",
            images: ia.imageGallery,
          },
        })
      );
    }, client.transaction());

  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(imageAssets);

  return await commitTransaction(transaction);
};

const slugify = (string) => {
  const a =
    "àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;";
  const b =
    "aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------";
  const p = new RegExp(a.split("").join("|"), "g");

  return string
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(p, (c) => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
};

const equipmentFetch = async (pageNo, pageSize) => {
  const url =
    "https://erpintegration.newmantractor.com:6443/ERPIntegrator.svc/e-Emphasys/Raw/ERPIntegrator/JsonCDATA/EQPAPI";
  const body = `{\n"APIKey": "${E_EMPHASYS_API_KEY}", \n"PageNo": ${pageNo},\n"PageSize": ${pageSize}\n}`;
  let erpData;
  try {
    await fetch(url, {
      method: "POST",
      body: body,
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        erpData = data;
      });
  } catch (err) {
    console.log(err);
    return { statusCode: 500, body: err.toString() };
  }

  // Use for testing with sample data
  // const erpData = erpSampleData

  console.log("erpData count:", erpData.equipmentData.length);

  const excludedCategories = [
    "FLEET",
    "CCBC",
    "CCBL",
    "CCF",
    "FIXED ASSETS",
    "FIXED ASSETS PRODUCT CATEGORY",
  ];
  const erpDataFiltered = await erpData.equipmentData.filter((d) => {
    return (
      !excludedCategories.includes(d.ProductCategoryDesc) &&
      d.EquipmentStatus !== "Sold" &&
      d.EquipmentStatus !== "Customer Stock" &&
      d.EquipmentStatus !== "Purchase Return" &&
      d.EquipmentStatus !== "Consignment Return" &&
      d.EquipmentStatus !== "Consignment" &&
      d.EquipmentStatus !== "On Order"
    );
  });

  // console.log('erpDataFiltered:', erpDataFiltered)
  console.log("erpDataFiltered count:", erpDataFiltered.length);

  // Used for testing
  // fs.writeFile('sample-erp-data-filtered.json', JSON.stringify(erpDataFiltered), err => {
  //   if (err) {
  //     console.error(err)
  //     return
  //   }
  //   //file written successfully
  // })

  return erpDataFiltered;
};

const equipmentFetchSold = async (pageNo, pageSize) => {
  const url =
    "https://erpintegration.newmantractor.com:6443/ERPIntegrator.svc/e-Emphasys/Raw/ERPIntegrator/JsonCDATA/EQPAPI";
  const body = `{\n"APIKey": "${E_EMPHASYS_API_KEY}", \n"PageNo": ${pageNo},\n"PageSize": ${pageSize}\n}`;
  let erpData;
  try {
    await fetch(url, {
      method: "POST",
      body: body,
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        erpData = data;
      });
  } catch (err) {
    console.log(err);
    return { statusCode: 500, body: err.toString() };
  }

  console.log("erpData count:", erpData.equipmentData.length);

  const excludedCategories = [
    "FLEET",
    "CCBC",
    "CCBL",
    "CCF",
    "FIXED ASSETS",
    "FIXED ASSETS PRODUCT CATEGORY",
  ];
  const erpDataFiltered = await erpData.equipmentData.filter((d) => {
    return (
      !excludedCategories.includes(d.ProductCategoryDesc) &&
      d.EquipmentStatus === "Sold"
    );
  });

  console.log("erpDataFiltered count:", erpDataFiltered.length);

  return erpDataFiltered;
};

const triggerBuild = async () => {
  const url = "https://api.netlify.com/build_hooks/5fa766fba4fba86fdd418617";
  try {
    await fetch(url, {
      method: "POST",
    });
  } catch (err) {
    console.log(err);
    return { statusCode: 500, body: err.toString() };
  }
  return;
};

const createCategories = async (erpData) => {
  const data = erpData;

  const categoriesSanity = await client
    .fetch(
      '*[_type == "equipmentCategory" && !(_id in path("drafts.**"))] {_id, _type, title, categoryType, slug}'
    )
    .then((currCat) => {
      return currCat;
    });

  // This reduces the array to unique values to remove duplicate categories in the dataset.
  const uniqueCategories = data.filter(
    (v, i, a) =>
      a.findIndex(
        (t) =>
          t.ProductCategoryDesc === v.ProductCategoryDesc &&
          t.EquipmentType === v.EquipmentType
      ) === i
  );

  const dupeCategories = uniqueCategories.map((c) => {
    const count = uniqueCategories.filter(
      (obj) => obj.ProductCategoryDesc === c.ProductCategoryDesc
    ).length;
    if (count > 1) {
      console.log("Duplicate Found: ", c);
    }
    return;
  });

  const categoriesErp = uniqueCategories.map((cat) => {
    const slug = slugify(cat.ProductCategoryDesc);
    const current = categoriesSanity.find((c) => c.slug.current === slug);
    return {
      _id: current ? current._id : uuidv4(),
      _type: "equipmentCategory",
      title: cat.ProductCategoryDesc,
      categoryType: cat.EquipmentType.toLowerCase(), // TODO: Set actual type
      slug: {
        current: slug,
      },
    };
  });

  console.log("categoriesErp count:", categoriesErp.length);
  // console.log('categoriesErp:', categoriesErp)

  // Reduce array used for update down to only records that have changed.
  const changedCategories = categoriesErp.filter((catErp) => {
    const matchingCategories = categoriesSanity.find((catSan) => {
      if (catErp._id === catSan._id) {
        return !objectsEqual(catSan, catErp);
      }
      return false;
    });
    // console.log('matchingCategories', matchingCategories)
    const newCategories = () => {
      if (
        !categoriesSanity.find(
          (catSan) => catSan.slug.current === catErp.slug.current
        )
      ) {
        return catErp;
      }
      return null;
    };
    // console.log('newCategories', newCategories())
    return matchingCategories + newCategories();
  });
  console.log("changedCategories:", changedCategories);
  console.log("changedCategories.length:", changedCategories.length);

  const createTransaction = (changedCategories) =>
    changedCategories.reduce(
      (tx, cat) => tx.createIfNotExists(cat).patch(cat._id, (p) => p.set(cat)),
      client.transaction()
    );
  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(changedCategories);
  await commitTransaction(transaction);
  return null;
};

const objectsEqual = (o1, o2) =>
  o1 !== null &&
  o2 !== null &&
  typeof o1 === "object" &&
  Object.keys(o1).length > 0
    ? Object.keys(o1).length === Object.keys(o2).length &&
      Object.keys(o1).every((p) => objectsEqual(o1[p], o2[p]))
    : o1 === o2;

const createLocations = async (erpData) => {
  const data = erpData;
  const locationsSanity = await client
    .fetch(
      '*[_type == "location" && !(_id in path("drafts.**"))] {_id, _type, slug, erpId, title, generalPhone, address1, city, state, zipCode, country}'
    )
    .then((currLoc) => {
      return currLoc;
    });

  const uniqueLocationsErp = [
    ...new Map(data.map((v) => [v.CurrentEquipmentOffice, v])).values(),
  ];
  console.log(
    "unique locations from erp data length:",
    uniqueLocationsErp.length
  );

  const locationsErp = uniqueLocationsErp.map((loc) => {
    const slug = slugify(loc.CurrentEquipmentOfficeDesc);
    const current = locationsSanity.find((c) => c.slug.current === slug);
    return {
      _id: current ? current._id : uuidv4(),
      _type: "location",
      slug: {
        current: slug,
      },
      erpId: loc.CurrentEquipmentOffice,
      title: toTitleCase(loc.CurrentEquipmentOfficeDesc.toLowerCase()),
      generalPhone: loc.AddressTelephone,
      address1: toTitleCase(loc.AddressName.toLowerCase()),
      city: toTitleCase(loc.AddressCity.toLowerCase()),
      state: loc.AddressState,
      zipCode: loc.AddressZipcode,
      country: "United States",
    };
  });

  const changedLocations = locationsErp.filter((locErp) => {
    const matchingLocations = locationsSanity.find((locSan) => {
      if (locErp._id === locSan._id) {
        if (!objectsEqual(locSan, locErp)) {
          console.log("Item changed from:", locSan);
          console.log("Item changed to:", locErp);
        }

        return !objectsEqual(locSan, locErp);
      }
      return false;
    });
    const newLocations = () => {
      if (
        !locationsSanity.find(
          (locSan) => locSan.slug.current === locErp.slug.current
        )
      ) {
        return locErp;
      }
      return null;
    };
    return matchingLocations + newLocations();
  });
  console.log("changedLocations", changedLocations);
  console.log("changedLocations.length", changedLocations.length);

  const createTransaction = (changedLocations) =>
    changedLocations.reduce(
      (tx, loc) => tx.createIfNotExists(loc).patch(loc._id, (p) => p.set(loc)),
      client.transaction()
    );
  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(changedLocations);
  await commitTransaction(transaction);
  return;
};

const createMakes = async (erpData) => {
  const data = erpData;

  const makesSanity = await client
    .fetch(
      '*[_type == "equipmentMake" && !(_id in path("drafts.**"))] {_id, _type, name, slug}'
    )
    .then((currMak) => {
      return currMak;
    });
  // console.log('makesSanity', makesSanity)

  // This reduces the array to unique values to remove duplicate categories in the dataset.
  const uniqueMakesErp = [
    ...new Set(data.map((item) => item.ManufacturerDesc)),
  ];

  const makesErp = uniqueMakesErp.map((mak) => {
    const slug = slugify(mak);
    const current = makesSanity.find((m) => m.slug.current === slug);
    return {
      _id: current ? current._id : uuidv4(),
      _type: "equipmentMake",
      name: mak,
      slug: {
        current: slug,
      },
    };
  });
  // console.log('makesErp', makesErp)
  console.log("makesArr count", makesErp.length);

  // Reduce array used for update down to only records that have changed.
  const changedMakes = makesErp.filter((makErp) => {
    const matchingMakes = makesSanity.find((makSan) => {
      if (makErp._id === makSan._id) {
        return !objectsEqual(makSan, makErp);
      }
      return false;
    });
    const newMakes = () => {
      if (
        !makesSanity.find(
          (makSan) => makSan.slug.current === makErp.slug.current
        )
      ) {
        return makErp;
      }
      return null;
    };
    return matchingMakes + newMakes();
  });
  console.log("changedMakes:", changedMakes);
  console.log("changedMakes.length:", changedMakes.length);

  const createTransaction = (changedMakes) =>
    changedMakes.reduce(
      (tx, mak) => tx.createIfNotExists(mak).patch(mak._id, (p) => p.set(mak)),
      client.transaction()
    );
  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(changedMakes);
  await commitTransaction(transaction);
  return;
};

const createModels = async (erpData) => {
  const data = erpData;
  const currentCategoriesNew = await client
    .fetch(
      '*[_type == "equipmentCategory" && !(_id in path("drafts.**"))] {_id, title, slug}'
    )
    .then((currCat) => {
      return currCat;
    });
  const currentMakesNew = await client
    .fetch(
      '*[_type == "equipmentMake" && !(_id in path("drafts.**"))] {_id, name, slug}'
    )
    .then((currMak) => {
      return currMak;
    });
  const modelsSanity = await client
    .fetch(
      '*[_type == "models" && !(_id in path("drafts.**"))] {_id, _type, title, slug, equipmentCategories, equipmentMake}'
    )
    .then((currMod) => {
      return currMod;
    });

  // This reduces the array to unique values to remove duplicate models in the dataset.
  const models = [...new Map(data.map((v) => [v.Model, v])).values()];

  const modelsErp = models.map((mod) => {
    const slug = slugify(
      `${mod.ManufacturerDesc}-${mod.Model}--${mod.ProductCategoryDesc}`
    );
    const currentCategory = currentCategoriesNew.find(
      (c) => c.slug.current === slugify(mod.ProductCategoryDesc)
    );
    const currentMake = currentMakesNew.find(
      (c) => c.slug.current === slugify(mod.ManufacturerDesc)
    );
    const current = modelsSanity.find((c) => c.slug.current === slug);
    return {
      _id: current ? current._id : uuidv4(),
      _type: "models",
      title: mod.Model,
      slug: {
        current: slug,
      },
      equipmentCategories: {
        _type: "reference",
        _ref: currentCategory._id,
      },
      equipmentMake: {
        _type: "reference",
        _ref: currentMake._id,
      },
    };
  });
  console.log("modelsErp count", modelsErp.length);
  // console.log('modelsErp:', modelsErp)

  const changedModels = modelsErp.filter((modErp) => {
    const matchingModels = modelsSanity.find((modSan) => {
      if (modErp._id === modSan._id) {
        if (!objectsEqual(modSan, modErp)) {
          console.log("Item changed from:", modSan);
          console.log("Item changed to:", modErp);
        }

        return !objectsEqual(modSan, modErp);
      }
      return false;
    });
    const newModels = () => {
      if (
        !modelsSanity.find(
          (modSan) => modSan.slug.current === modErp.slug.current
        )
      ) {
        return modErp;
      }
      return null;
    };
    return matchingModels + newModels();
  });
  console.log("changedModels", changedModels);
  console.log("changedModels.length", changedModels.length);

  const createTransaction = (changedModels) =>
    changedModels.reduce(
      (tx, mod) => tx.createIfNotExists(mod).patch(mod._id, (p) => p.set(mod)),
      client.transaction()
    );
  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(changedModels);
  await commitTransaction(transaction);
  return;
};

const createEquipment = async (erpData) => {
  const data = erpData;
  const currentCategoriesNew = await client
    .fetch(
      '*[_type == "equipmentCategory" && !(_id in path("drafts.**"))] {_id, title, slug}'
    )
    .then((currCat) => {
      return currCat;
    });
  const currentMakesNew = await client
    .fetch(
      '*[_type == "equipmentMake" && !(_id in path("drafts.**"))] {_id, name, slug}'
    )
    .then((currMak) => {
      return currMak;
    });
  const currentModelNew = await client
    .fetch(
      '*[_type == "models" && !(_id in path("drafts.**"))] {_id, name, slug}'
    )
    .then((currMod) => {
      return currMod;
    });
  const currentLocationNew = await client
    .fetch(
      '*[_type == "location" && !(_id in path("drafts.**"))] {_id, name, slug}'
    )
    .then((currLoc) => {
      return currLoc;
    });

  const equipmentSanity = await client
    .fetch(
      '*[_type == "inventory" && !(_id in path("drafts.**"))]{_id, _type, title, slug, stockNumber, specification, price, condition, year, model, modelReference, hoursCurrent, serial, equipmentMake, equipmentCategories, location, status, deliveryDate, movementDate }'
    )
    .then((currEq) => {
      return currEq.map((eq) => {
        return {
          _id: eq._id,
          _type: "inventory",
          title: eq.title,
          slug: eq.slug,
          stockNumber: eq.stockNumber,
          specification: eq.specification || "",
          ...(eq.price && { price: eq.price }),
          condition: eq.condition,
          ...(eq.year && { year: eq.year }),
          model: eq.model,
          ...(eq.hoursCurrent && { hoursCurrent: eq.hoursCurrent }),
          serial: eq.serial,
          ...(eq.modelReference && {
            modelReference: {
              _type: "reference",
              _ref: eq.modelReference._ref,
            },
          }),
          equipmentMake: {
            _type: "reference",
            _ref: eq.equipmentMake._ref,
          },
          equipmentCategories: {
            _type: "reference",
            _ref: eq.equipmentCategories._ref,
          },
          location: {
            _type: "reference",
            _ref: eq.location._ref,
          },
          ...(eq.status && { status: eq.status }),
          ...(eq.deliveryDate && { deliveryDate: eq.deliveryDate }),
          ...(eq.movementDate && { movementDate: eq.movementDate }),
        };
      });
    });

  const equipmentErp = data.map((eq) => {
    const currentCategory = currentCategoriesNew.find(
      (c) => c.slug.current === slugify(eq.ProductCategoryDesc)
    );
    const currentMake = currentMakesNew.find(
      (c) => c.slug.current === slugify(eq.ManufacturerDesc)
    );
    const currentModel = currentModelNew.find(
      (c) =>
        c.slug.current ===
        slugify(`${eq.ManufacturerDesc}-${eq.Model}--${eq.ProductCategoryDesc}`)
    );
    if (currentModel === undefined) {
      console.log("undefined currentModel: ", eq);
    }

    const currentLocation = currentLocationNew.find(
      (c) => c.slug.current === slugify(eq.CurrentEquipmentOfficeDesc)
    );

    const yearFixed = eq.ModelYear === 0 ? "" : eq.ModelYear;
    const titleFixed = eq.EquipmentDesc.replace(/(19|20)[0-9][0-9]/, "").trim();
    const title = `${
      eq.EquipmentType == "Attachment" ? "" : yearFixed
    } ${titleFixed}`;
    const price = eq.ModelListPrice !== 0 && eq.ModelListPrice;
    const year = eq.ModelYear !== 0 && eq.ModelYear;
    const hoursCurrent =
      eq.CurrentMeterReading1 !== 0 && eq.CurrentMeterReading1;
    const serial = eq.SerialNo;
    const stockNumber = `EQ${eq.EquipmentId.replace(/^(EQ)+/gm, "")
      .trim()
      .replace(/\b0+/g, "")
      .trim()}`;
    const specifications = JSON.stringify(eq.Specifications);
    const condition = () => (eq.Used === "Yes" ? "used" : "new");
    const slugValue = `${yearFixed} ${titleFixed}`;

    return {
      _id: eq.EquipmentId,
      _type: "inventory",
      title: title.trim(),
      slug: {
        current: `${slugify(slugValue.trim())}-${eq.EquipmentId}`,
      },
      stockNumber: stockNumber,
      specification: specifications || "",
      ...(price && { price: price }),
      condition: condition(),
      ...(year && { year: year }),
      model: eq.Model,
      ...(hoursCurrent && { hoursCurrent: hoursCurrent }),
      serial: serial,
      ...(currentModel && {
        modelReference: {
          _type: "reference",
          _ref: currentModel._id,
        },
      }),
      equipmentMake: {
        _type: "reference",
        _ref: currentMake._id,
      },
      equipmentCategories: {
        _type: "reference",
        _ref: currentCategory._id,
      },
      location: {
        _type: "reference",
        _ref: currentLocation._id,
      },
      ...(eq.EquipmentStatus && { status: "stock" }),
      ...(eq.ExpectedDelDate && { deliveryDate: eq.ExpectedDelDate }),
      ...(eq.MovementDate && { movementDate: eq.MovementDate }),
    };
  });

  // console.log('equipmentErp:', equipmentErp)
  console.log("equipmentErp count:", equipmentErp.length);

  const changedEquipment = equipmentErp.filter((eqErp) => {
    const matchingEquipment = equipmentSanity.find((eqSan) => {
      if (eqErp._id === eqSan._id) {
        if (!objectsEqual(eqSan, eqErp)) {
          console.log("Item changed from:", eqSan);
          console.log("Item changed to:", eqErp);
        }
        if (!eqErp.year && eqSan.year >= 0) {
          console.log("Year needs unset");
          unsetValue(eqSan._id, "year");
        }
        if (!eqErp.price && eqSan.price >= 0) {
          console.log("Price needs unset");
          unsetValue(eqSan._id, "price");
        }
        if (!eqErp.hoursCurrent && eqSan.hoursCurrent >= 0) {
          console.log("Price needs unset");
          unsetValue(eqSan._id, "hoursCurrent");
        }
        return !objectsEqual(eqSan, eqErp);
      }
      return false;
    });
    const newEquipment = () => {
      if (
        !equipmentSanity.find(
          (eqSan) => eqSan.slug.current === eqErp.slug.current
        )
      ) {
        console.log("New items: ", eqErp);
        return eqErp;
      }
      return false;
    };
    return matchingEquipment + newEquipment();
  });
  // console.log('changedEquipment', changedEquipment)
  console.log("changedEquipment.length", changedEquipment.length);

  const createTransaction = (changedEquipment) =>
    changedEquipment.reduce(
      (tx, eq) => tx.createIfNotExists(eq).patch(eq._id, (p) => p.set(eq)),
      client.transaction()
    );
  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(changedEquipment);
  await commitTransaction(transaction);
  return;
};

const unsetValue = async (id, field) => {
  return client.patch(id).unset([field]).commit();
};

const deleteEquipment = async (erpDAta) => {
  const currentInventory = await client
    .fetch('*[_type == "inventory"] {_id, title, slug}')
    .then((currInv) => {
      return currInv;
    });

  console.log("currentInventory length:", currentInventory.length);

  const toDelete = currentInventory.filter(
    ({ _id: id1 }) => !erpDAta.some(({ EquipmentId: id2 }) => id2 === id1)
  );

  console.log("toDelete length:", toDelete.length);

  const deleteArr = toDelete.map((del) => del._id);

  console.log("deleteArr count", deleteArr.length);

  // const one = deleteArr.slice(0, 1).map(one => one)
  // console.log('one:', one)

  const createTransaction = (deleteArr) =>
    deleteArr.reduce((tx, del) => tx.delete(del), client.transaction());
  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(deleteArr);
  await commitTransaction(transaction);
  return;
};

const updateSoldEquipment = async (erpData) => {
  const erpDataSoldIds = erpData.map((item) => item.EquipmentId);

  const updateSoldArr = await client
    .fetch(
      `*[_type == "inventory" && status != 'sold' && _id in ${JSON.stringify(
        erpDataSoldIds
      )} ] {_id}`
    )
    .then((currInv) => {
      return currInv;
    });

  console.log("# cms items to be updated:", updateSoldArr.length);
  console.log("cms items to be updated", JSON.stringify(updateSoldArr));

  const createTransaction = (updateSoldArr) =>
    updateSoldArr.reduce((tx, ia) => {
      // console.log("updating to sold:", ia._id);
      return tx.patch(ia._id, (p) =>
        p.set({
          status: "sold",
        })
      );
    }, client.transaction());

  const commitTransaction = (tx) => tx.commit();
  const transaction = createTransaction(updateSoldArr);

  return await commitTransaction(transaction);
};

const productFetch = async () => {
  const products = await client.fetch(
    `*[_type in ["inventory", "ecommerceProduct", "equipmentSubCategory", "equipmentOptions", "models"] && !(_id in path("drafts.**"))] {_id, "sku": _id, _type, descriptionBlock, price, title, slug, hubSpotProductId, mainImage{asset->{url}}, equipmentCategories->{slug, title}, defaultProductVariant{price, sku}, 'productImage': defaultProductVariant{'image':images[0]{asset->{url}}}, "make": equipmentMake->{name, slug} }`
  );
  return products;
};

const toPlainText = (blocks = []) => {
  if (!blocks) {
    return "";
  }
  return (
    blocks
      // loop through each block
      .map((block) => {
        // if this is a parent block, grab the children and pass them to the function
        if (block.body && block.body.length > 0) {
          return toPlainText(block.body);
        }
        // if it's not a text block with children,
        // return nothing
        if (block._type !== "block" || !block.children) {
          return "";
        }
        // loop through the children spans, and join the
        // text strings
        return block.children.map((child) => child.text).join("");
      })
      // join the paragraphs leaving split by two linebreaks
      .join(" ")
  );
};

const getInventoryImageData = async (urlPageData, _id, url) => {
  try {
    const response = await fetch(urlPageData, {
      retry: 3,
      pause: 1000,
      callback: (retry) => {
        console.log(`Trying: ${retry}`);
      },
    });
    if (response.ok) {
      const data = await response.json();
      const obj = {
        id: data.result.data.inventory._id,
        photoDate: data.result.data.inventory.photoDate,
        hoursPhoto: data.result.data.inventory.hoursPhoto,
        mainImage: data.result.data.inventory.mainImage?.asset?._id,
        imageGallery: data.result.data.inventory.imageGallery?.images,
        urlPageData: urlPageData,
        url: url,
      };
      return obj;
    } else {
      return {
        id: _id,
        photoDate: "",
        hoursPhoto: "",
        mainImage: "",
        imageGallery: "",
        urlPageData: urlPageData,
        url: url,
        message: "No image data found",
      };
    }
  } catch (err) {
    console.log(err.message);
    return {
      id: _id,
      photoDate: "",
      hoursPhoto: "",
      mainImage: "",
      imageGallery: "",
      urlPageData: urlPageData,
      url: url,
      message: err.message,
    };
  }
};

const erpContactFetch = async (dataType, lastSyncDate) => {
  const url =
    "https://newmantest.eetcld.com:6443/ERPIntegrator.svc/e-Emphasys/Raw/ERPIntegrator/JSONCDATA/HUB";
  const body = {
    RequestMethod: dataType,
    LastSyncDate: lastSyncDate,
  };
  const headers = new Headers({
    Authorization: `Basic ${base64.encode(
      `${E_EMPHASYS_API_USERNAME}:${E_EMPHASYS_API_PASSWORD}`
    )}`,
  });

  let erpContactData;
  try {
    await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: headers,
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        erpContactData = data;
      });
  } catch (err) {
    console.log(err);
    return { statusCode: 500, body: err.toString() };
  }

  return erpContactData;
};

const geocodeAddress = async (address) => {
  let params = {
    address: address,
    components: "country:US",
    key: GOOGLE_MAPS_API_KEY,
  };

  // console.log("retrieving geocode data for " + address);
  const data = await geoClient
    .geocode({
      params: params,
    })
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      console.log("error retrieving geocoded results");
      console.log("error:", error);
      return error;
    });
  return data;
};

const salesContact = (county, state, cartType) => {
  const territories =
    TERRITORIES_FILE === "territoriesDev" ? territoriesDev : territoriesProd;
  // console.log("territories:", JSON.stringify(territories));

  const salesPersonMatch =
    county &&
    territories.find((c) => c.countyName === county && c.state === state);
  if (salesPersonMatch) {
    // console.log("found matching sales rep");
    return salesPersonMatch;
  } else if (cartType === "rental") {
    // console.log("fallback to rental sales rep");
    return JSON.parse(RENTAL_FALLBACK);
  } else if (state === "Florida") {
    // console.log("fallback to fl sales rep");
    return JSON.parse(SALES_FALLBACK_FL);
  } else if (state === "Kentucky") {
    // console.log("fallback to ky sales rep");
    return JSON.parse(SALES_FALLBACK_KY);
  } else {
    // console.log("no sales contact found");
    return JSON.parse(SALES_FALLBACK);
  }
};

const uniqueBy = (data, field) => {
  const hasEmail = data.filter((item) => item.Email !== "");
  const noEmail = data.filter((item) => item.Email === "");

  var dataArr = hasEmail.map((item) => {
    return item.Email === "" || [item[field].toLowerCase(), item];
  });
  var maparr = new Map(dataArr);
  var result = [...maparr.values()];

  return [...noEmail, ...result];
};

const wait = (timeToDelay) =>
  new Promise((resolve) => setTimeout(resolve, timeToDelay));

module.exports = {
  equipmentFetch,
  equipmentFetchSold,
  createMakes,
  createLocations,
  createCategories,
  createEquipment,
  deleteEquipment,
  updateSoldEquipment,
  fetchEquipmentInventory,
  fetchEquipmentInventory2,
  fetchEquipmentPhotos,
  uploadImages,
  addInventoryPhotos,
  triggerBuild,
  createModels,
  slugify,
  productFetch,
  toPlainText,
  getInventoryImageData,
  erpContactFetch,
  geocodeAddress,
  salesContact,
  uniqueBy,
  wait,
  formatPhoneNumber,
};
