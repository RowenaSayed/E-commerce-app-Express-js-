//governate model
const mongoose = require("mongoose");
const { Schema } = mongoose;
const GovernateSchema = new Schema({
    name: { type: String, required: true },
    fee: { type: Number, required: true },
    diliveryTime: { type:Number, type: String  }
}, { timestamps: true });
module.exports = mongoose.model("Governate", GovernateSchema);
// add egypt governates with fees and delivery times
// Cairo, Giza, Alexandria, Luxor, Aswan, Suez, Port Said, Ismailia, Tanta, Mansoura, Zagazig, Damanhur, El-Mahalla El-Kubra, Fayoum, Minya, Beni Suef, Sohag, Qena, Hurghada
const governates = [
    { name: "Cairo", fee: 50, diliveryTime: 1 },
    { name: "Giza", fee: 40, diliveryTime: 1 },
    { name: "Alexandria", fee: 60, diliveryTime: 2 },
    { name: "Luxor", fee: 100, diliveryTime: 3 },
    { name: "Aswan", fee: 120, diliveryTime: 3 },
    { name: "Suez", fee: 70, diliveryTime: 2 },
    { name: "Port Said", fee: 80, diliveryTime: 2 },
    { name: "Ismailia", fee: 75, diliveryTime: 2 },
    { name: "Tanta", fee: 55, diliveryTime: 1 },    
    { name: "Mansoura", fee: 65, diliveryTime: 2 },
    { name: "Zagazig", fee: 60, diliveryTime: 2 },
    { name: "Damanhur", fee: 70, diliveryTime: 2 },
    { name: "El-Mahalla El-Kubra", fee: 75, diliveryTime: 2 },
    { name: "Fayoum", fee: 90, diliveryTime: 2 },
    { name: "Minya", fee: 95, diliveryTime: 3 },
    { name: "Beni Suef", fee: 85, diliveryTime: 2 },
    { name: "Sohag", fee: 110, diliveryTime: 3 },
    { name: "Qena", fee: 115, diliveryTime: 3 },
    { name: "Hurghada", fee: 130, diliveryTime: 3 },
];
GovernateSchema.statics.initializeGovernates = async function () {
    for (const gov of governates) {
        const exists = await this.findOne({ name: gov.name });
        if (!exists) {
            await this.create(gov);
        }       
    }
}
GovernateSchema.statics.initializeGovernates = async function () {
    for (const gov of governates) {
        const exists = await this.findOne({ name: gov.name });  
        if (!exists) {
            await this.create(gov);
        }   
    }
}
GovernateSchema.statics.initializeGovernates = async function () {
    for (const gov of governates) {
        const exists = await this.findOne({ name: gov.name });  
        if (!exists) {
            await this.create(gov);
        }
    }
}
module.exports = mongoose.model("Governate", GovernateSchema);