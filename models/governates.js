const mongoose = require("mongoose");
const { Schema } = mongoose;

const GovernateSchema = new Schema({
    name: { type: String, required: true },
    fee: { type: Number, required: true },
    deliveryTime: { type: Number, required: true }
}, { timestamps: true });

const governates = [
    { name: "Cairo", fee: 50, deliveryTime: 1 },
    { name: "Giza", fee: 40, deliveryTime: 1 },
    { name: "Alexandria", fee: 60, deliveryTime: 2 },
    { name: "Luxor", fee: 100, deliveryTime: 3 },
    { name: "Aswan", fee: 120, deliveryTime: 3 },
    { name: "Suez", fee: 70, deliveryTime: 2 },
    { name: "Port Said", fee: 80, deliveryTime: 2 },
    { name: "Ismailia", fee: 75, deliveryTime: 2 },
    { name: "Tanta", fee: 55, deliveryTime: 1 },
    { name: "Mansoura", fee: 65, deliveryTime: 2 },
    { name: "Zagazig", fee: 60, deliveryTime: 2 },
    { name: "Damanhur", fee: 70, deliveryTime: 2 },
    { name: "El-Mahalla El-Kubra", fee: 75, deliveryTime: 2 },
    { name: "Fayoum", fee: 90, deliveryTime: 2 },
    { name: "Minya", fee: 95, deliveryTime: 3 },
    { name: "Beni Suef", fee: 85, deliveryTime: 2 },
    { name: "Sohag", fee: 110, deliveryTime: 3 },
    { name: "Qena", fee: 115, deliveryTime: 3 },
    { name: "Hurghada", fee: 130, deliveryTime: 3 }
];

GovernateSchema.statics.initializeGovernates = async function () {
    for (const gov of governates) {
        const exists = await this.findOne({ name: gov.name });
        if (!exists) {
            await this.create(gov);
        }
    }
}

module.exports = mongoose.model("Governate", GovernateSchema);
