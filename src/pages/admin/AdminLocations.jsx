import { Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { CheckboxInput, SelectInput, TextInput } from '../../components/admin/FormControls.jsx';
import { StatusMessage } from '../../components/admin/StatusMessage.jsx';
import {
  deleteLocationRecord,
  listLocationCatalogs,
  saveCity,
  saveCountry,
  saveProvince,
  slugify,
} from '../../services/adminService.js';

const emptyCountry = { active: true, id: '', iso_code: '', name: '', sort_order: 0 };
const emptyProvince = { active: true, country_id: '', id: '', name: '', sort_order: 0 };
const emptyCity = { active: true, id: '', name: '', province_id: '', sort_order: 0 };

function SectionTitle({ title }) {
  return <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>;
}

export default function AdminLocations() {
  const [catalogs, setCatalogs] = useState({ cities: [], countries: [], provinces: [] });
  const [countryForm, setCountryForm] = useState(emptyCountry);
  const [provinceForm, setProvinceForm] = useState(emptyProvince);
  const [cityForm, setCityForm] = useState(emptyCity);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(true);

  async function loadLocations() {
    setIsLoading(true);

    try {
      setCatalogs(await listLocationCatalogs());
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLocations();
  }, []);

  async function submitCountry(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      await saveCountry(countryForm);
      setCountryForm(emptyCountry);
      await loadLocations();
      setFeedback({ type: 'success', message: 'Pais guardado.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function submitProvince(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      await saveProvince(provinceForm);
      setProvinceForm(emptyProvince);
      await loadLocations();
      setFeedback({ type: 'success', message: 'Provincia guardada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function submitCity(event) {
    event.preventDefault();
    setFeedback({ type: '', message: '' });

    try {
      await saveCity(cityForm);
      setCityForm(emptyCity);
      await loadLocations();
      setFeedback({ type: 'success', message: 'Ciudad guardada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  async function handleDelete(table, recordId) {
    setFeedback({ type: '', message: '' });

    try {
      await deleteLocationRecord(table, recordId);
      await loadLocations();
      setFeedback({ type: 'success', message: 'Ubicacion eliminada.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  }

  function setCountryField(name, value) {
    setCountryForm((current) => ({
      ...current,
      [name]: value,
      id: name === 'name' && !current.id ? slugify(value) : current.id,
    }));
  }

  function setProvinceField(name, value) {
    setProvinceForm((current) => ({
      ...current,
      [name]: value,
      id: name === 'name' && !current.id ? slugify(`${current.country_id}-${value}`) : current.id,
    }));
  }

  function setCityField(name, value) {
    setCityForm((current) => ({
      ...current,
      [name]: value,
      id: name === 'name' && !current.id ? slugify(`${current.province_id}-${value}`) : current.id,
    }));
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogos"
        title="Ubicaciones"
        description="Gestiona la jerarquia Pais, Provincia y Ciudad usada por los perfiles."
      />

      <StatusMessage message={feedback.message} type={feedback.type} />
      {isLoading ? <p className="mt-4 text-sm text-slate-400">Cargando ubicaciones...</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-slate-800 bg-[#0f131a] p-5">
          <SectionTitle title="Paises" />
          <form className="space-y-4" onSubmit={submitCountry}>
            <TextInput label="Nombre" value={countryForm.name} onChange={(event) => setCountryField('name', event.target.value)} required />
            <TextInput label="ID" value={countryForm.id} onChange={(event) => setCountryField('id', event.target.value)} required />
            <TextInput label="Codigo ISO" value={countryForm.iso_code ?? ''} onChange={(event) => setCountryField('iso_code', event.target.value)} />
            <TextInput label="Orden" type="number" value={countryForm.sort_order} onChange={(event) => setCountryField('sort_order', event.target.value)} />
            <CheckboxInput checked={countryForm.active !== false} label="Activo" onChange={(value) => setCountryField('active', value)} />
            <button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-500" type="submit">
              <Save aria-hidden="true" size={16} />
              Guardar pais
            </button>
          </form>
          <div className="mt-5 space-y-2">
            {catalogs.countries.map((country) => (
              <div key={country.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950 p-3">
                <button className="min-w-0 text-left" type="button" onClick={() => setCountryForm(country)}>
                  <span className="block truncate text-sm font-medium text-white">{country.name}</span>
                  <span className="block truncate text-xs text-slate-500">{country.id}</span>
                </button>
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 transition hover:border-rose-500 hover:text-white" type="button" aria-label="Eliminar pais" title="Eliminar pais" onClick={() => handleDelete('countries', country.id)}>
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-[#0f131a] p-5">
          <SectionTitle title="Provincias" />
          <form className="space-y-4" onSubmit={submitProvince}>
            <SelectInput label="Pais" value={provinceForm.country_id} onChange={(event) => setProvinceField('country_id', event.target.value)} required>
              <option value="">Seleccionar</option>
              {catalogs.countries.map((country) => (
                <option key={country.id} value={country.id}>{country.name}</option>
              ))}
            </SelectInput>
            <TextInput label="Nombre" value={provinceForm.name} onChange={(event) => setProvinceField('name', event.target.value)} required />
            <TextInput label="ID" value={provinceForm.id} onChange={(event) => setProvinceField('id', event.target.value)} required />
            <TextInput label="Orden" type="number" value={provinceForm.sort_order} onChange={(event) => setProvinceField('sort_order', event.target.value)} />
            <CheckboxInput checked={provinceForm.active !== false} label="Activa" onChange={(value) => setProvinceField('active', value)} />
            <button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-500" type="submit">
              <Save aria-hidden="true" size={16} />
              Guardar provincia
            </button>
          </form>
          <div className="mt-5 space-y-2">
            {catalogs.provinces.map((province) => (
              <div key={province.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950 p-3">
                <button className="min-w-0 text-left" type="button" onClick={() => setProvinceForm(province)}>
                  <span className="block truncate text-sm font-medium text-white">{province.name}</span>
                  <span className="block truncate text-xs text-slate-500">{province.country_id}</span>
                </button>
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 transition hover:border-rose-500 hover:text-white" type="button" aria-label="Eliminar provincia" title="Eliminar provincia" onClick={() => handleDelete('provinces', province.id)}>
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-[#0f131a] p-5">
          <SectionTitle title="Ciudades" />
          <form className="space-y-4" onSubmit={submitCity}>
            <SelectInput label="Provincia" value={cityForm.province_id} onChange={(event) => setCityField('province_id', event.target.value)} required>
              <option value="">Seleccionar</option>
              {catalogs.provinces.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </SelectInput>
            <TextInput label="Nombre" value={cityForm.name} onChange={(event) => setCityField('name', event.target.value)} required />
            <TextInput label="ID" value={cityForm.id} onChange={(event) => setCityField('id', event.target.value)} required />
            <TextInput label="Orden" type="number" value={cityForm.sort_order} onChange={(event) => setCityField('sort_order', event.target.value)} />
            <CheckboxInput checked={cityForm.active !== false} label="Activa" onChange={(value) => setCityField('active', value)} />
            <button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-3 text-sm font-semibold text-white transition hover:bg-rose-500" type="submit">
              <Save aria-hidden="true" size={16} />
              Guardar ciudad
            </button>
          </form>
          <div className="mt-5 space-y-2">
            {catalogs.cities.map((city) => (
              <div key={city.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950 p-3">
                <button className="min-w-0 text-left" type="button" onClick={() => setCityForm(city)}>
                  <span className="block truncate text-sm font-medium text-white">{city.name}</span>
                  <span className="block truncate text-xs text-slate-500">{city.province_id}</span>
                </button>
                <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 text-slate-400 transition hover:border-rose-500 hover:text-white" type="button" aria-label="Eliminar ciudad" title="Eliminar ciudad" onClick={() => handleDelete('cities', city.id)}>
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
