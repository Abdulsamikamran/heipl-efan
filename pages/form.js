import { useRouter } from "next/router";
import { useEffect, useReducer, useRef, useState, useCallback } from "react";
import Head from "next/head";
import Layout from "../components/Layout";
import {
  FORM_SCHEMA,
  SECTION_CONFIG,
  getInitialFormState,
  getFieldsBySection,
  AUTOCOMPLETE_FIELDS,
  AGENT_PREFILL_FIELDS,
} from "../lib/formSchema";
import {
  addRecord,
  updateRecord,
  getRecord,
  getAllRecords,
  addAutocompleteEntry,
  getAutocompleteSuggestions,
  getAllSettings,
} from "../lib/db";
import {
  generateFormNumber,
  generateUUID,
  getToday,
  getCurrentMonth,
  titleCaseValue,
  formatDateDisplay,
  isEmpty,
} from "../lib/utils";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { syncPendingRecords } from "../lib/sync";
import TextInput from "../components/ui/TextInput";
import SelectInput from "../components/ui/SelectInput";
import RadioGroup from "../components/ui/RadioGroup";
import DateInput from "../components/ui/DateInput";
import TextAreaInput from "../components/ui/TextAreaInput";
import NumberInput from "../components/ui/NumberInput";
import FormSection from "../components/ui/FormSection";
import ErrorSummary from "../components/ui/ErrorSummary";

const METADATA_FIELDS = [
  "id",
  "syncStatus",
  "syncError",
  "syncedAt",
  "createdAt",
  "updatedAt",
];

const AGENT_SETTING_KEYS = {
  fieldAgentName: "agentName",
  agentEmployeeId: "agentEmployeeId",
  agentMobileNumber: "agentMobile",
};

function formReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.name]: action.value };
    case "SET_MULTIPLE":
      return { ...state, ...action.values };
    case "RESET_FORM":
      return { ...getInitialFormState(), ...action.defaults };
    case "LOAD_RECORD": {
      const record = { ...action.record };
      METADATA_FIELDS.forEach((field) => {
        delete record[field];
      });
      return { ...getInitialFormState(), ...record };
    }
    default:
      return state;
  }
}

function WarningBanner({ message, type = "warning" }) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };

  const icons = {
    warning: "⚠️",
    error: "🚫",
    info: "ℹ️",
  };

  return (
    <div
      className={`mt-2 flex items-start gap-2 rounded-lg border p-3 text-sm ${styles[type] || styles.warning}`}
    >
      <span>{icons[type] || icons.warning}</span>
      <span>{message}</span>
    </div>
  );
}

function ToastItem({ toast }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const typeStyles = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    info: "bg-gray-800 text-white",
    warning: "bg-amber-500 text-white",
  };

  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  };

  return (
    <div
      className={`pointer-events-auto flex transform items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${typeStyles[toast.type] || typeStyles.info}`}
    >
      <span className="text-lg">{icons[toast.type] || icons.info}</span>
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}

function DuplicateWarningModal({ duplicateInfo, onContinue, onCancel }) {
  const statusClass =
    {
      draft: "status-draft",
      pending: "status-pending",
      synced: "status-synced",
      failed: "status-failed",
    }[duplicateInfo.syncStatus] || "status-draft";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        role="presentation"
      />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-amber-700">
          ⚠️ Duplicate CNIC Detected
        </h3>
        <div className="mt-4 space-y-2 text-sm text-gray-700">
          <p>A record with this CNIC already exists:</p>
          <p>
            <strong>Name:</strong> {duplicateInfo.fullName}
          </p>
          <p>
            <strong>Form No:</strong> {duplicateInfo.formNumber}
          </p>
          <p>
            <strong>Date:</strong>{" "}
            {formatDateDisplay(duplicateInfo.date) || "N/A"}
          </p>
          <p className="flex items-center gap-2">
            <strong>Status:</strong>
            <span className={statusClass}>
              {duplicateInfo.syncStatus || "unknown"}
            </span>
          </p>
          <p className="pt-2">Do you want to continue with this form anyway?</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
            onClick={onContinue}
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function PostSubmitModal({ onNewForm, onViewRecords }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" role="presentation" />
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-green-700">✅ Form Saved!</h3>
        <p className="mt-3 text-sm text-gray-600">
          What would you like to do next?
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn-primary flex-1 py-3"
            onClick={onNewForm}
          >
            Start New Form
          </button>
          <button
            type="button"
            className="btn-secondary flex-1 py-3"
            onClick={onViewRecords}
          >
            View All Records
          </button>
        </div>
      </div>
    </div>
  );
}

function buildAgentDefaults(settings = {}) {
  const defaults = {
    formNumber: generateFormNumber(),
    date: getToday(),
    billMonthLatest: getCurrentMonth(),
  };

  AGENT_PREFILL_FIELDS.forEach((fieldName) => {
    const settingKey = AGENT_SETTING_KEYS[fieldName];
    defaults[fieldName] = settings[settingKey] || "";
  });

  return defaults;
}

export default function FormPage() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [formData, dispatch] = useReducer(
    formReducer,
    undefined,
    getInitialFormState,
  );
  const [errors, setErrors] = useState({});
  const [recordId, setRecordId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [activeSuggestions, setActiveSuggestions] = useState({});
  const [showSuggestions, setShowSuggestions] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentSettings, setAgentSettings] = useState({});
  const [showPostSubmitModal, setShowPostSubmitModal] = useState(false);

  const fieldRefs = useRef({});
  const isDirtyRef = useRef(false);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const showToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      },
      type === "error" ? 4000 : 2500,
    );
  }, []);

  const saveDraft = useCallback(async () => {
    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      const recordObj = {
        ...formDataRef.current,
        syncStatus: "draft",
        updatedAt: now,
      };

      if (!recordId) {
        const newId = generateUUID();
        recordObj.id = newId;
        recordObj.createdAt = now;
        const savedId = await addRecord(recordObj);
        if (savedId) {
          setRecordId(savedId);
        }
      } else {
        await updateRecord(recordId, recordObj);
      }

      isDirtyRef.current = false;
      showToast("Draft saved", "info");
      return true;
    } catch (error) {
      console.error("saveDraft error:", error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [recordId, showToast]);

  const handleCrossFieldLogic = useCallback((changedField, newValue) => {
    const currentData = formDataRef.current;
    const autoFills = {};

    switch (changedField) {
      case "isHomeOwner":
        autoFills.check1HomeOwner = newValue === "Yes (Owner)" ? "Yes" : "No";
        break;
      case "billInApplicantName":
        autoFills.check2BillInName = newValue === "Yes" ? "Yes" : "No";
        break;
      case "latePayments24Months":
        autoFills.check4FewerThan4Late = ["None", "1", "2"].includes(newValue)
          ? "Yes"
          : "No";
        break;
      case "activeInstallmentOnBill":
        autoFills.check5NoActiveInstallment = newValue === "No" ? "Yes" : "No";
        break;
      case "simRegisteredSameCnic":
        autoFills.check6SimSameCnic =
          newValue === "Yes – confirmed" ? "Yes" : "No";
        break;
      case "connectionType":
        autoFills.check7ResidentialOnly =
          newValue === "Residential (Domestic)" ? "Yes" : "No";
        break;
      case "fanDeliveryAddressSame":
        if (newValue === "Yes") {
          autoFills.alternateDeliveryAddress =
            currentData.completeDeliveryAddress;
        }
        break;
      case "completeDeliveryAddress":
        if (currentData.fanDeliveryAddressSame === "Yes") {
          autoFills.alternateDeliveryAddress = newValue;
        }
        break;
      default:
        break;
    }

    const currentChecks = {
      check1HomeOwner: autoFills.check1HomeOwner ?? currentData.check1HomeOwner,
      check2BillInName:
        autoFills.check2BillInName ?? currentData.check2BillInName,
      check3CnicValid: currentData.check3CnicValid,
      check4FewerThan4Late:
        autoFills.check4FewerThan4Late ?? currentData.check4FewerThan4Late,
      check5NoActiveInstallment:
        autoFills.check5NoActiveInstallment ??
        currentData.check5NoActiveInstallment,
      check6SimSameCnic:
        autoFills.check6SimSameCnic ?? currentData.check6SimSameCnic,
      check7ResidentialOnly:
        autoFills.check7ResidentialOnly ?? currentData.check7ResidentialOnly,
    };

    const allYes = Object.values(currentChecks).every(
      (value) => value === "Yes",
    );
    const anyNo = Object.values(currentChecks).some((value) => value === "No");

    if (allYes) {
      autoFills.fieldAgentAssessment =
        "LIKELY ELIGIBLE – Forward for data entry";
    } else if (anyNo) {
      autoFills.fieldAgentAssessment = "LIKELY INELIGIBLE – Do not forward ";
    }

    if (Object.keys(autoFills).length > 0) {
      dispatch({ type: "SET_MULTIPLE", values: autoFills });
      isDirtyRef.current = true;
    }
  }, []);

  const handleFieldChange = useCallback(
    (name, value) => {
      dispatch({ type: "SET_FIELD", name, value });
      isDirtyRef.current = true;

      setErrors((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });

      if (AUTOCOMPLETE_FIELDS.includes(name) && value.length >= 1) {
        getAutocompleteSuggestions(name, value).then((suggestions) => {
          setActiveSuggestions((prev) => ({ ...prev, [name]: suggestions }));
          setShowSuggestions((prev) => ({ ...prev, [name]: true }));
        });
      } else if (AUTOCOMPLETE_FIELDS.includes(name) && value.length === 0) {
        getAutocompleteSuggestions(name, "").then((suggestions) => {
          setActiveSuggestions((prev) => ({ ...prev, [name]: suggestions }));
        });
        setShowSuggestions((prev) => ({ ...prev, [name]: false }));
      }

      formDataRef.current = { ...formDataRef.current, [name]: value };
      handleCrossFieldLogic(name, value);
    },
    [handleCrossFieldLogic],
  );

  const handleSuggestionSelect = useCallback(
    (name, value) => {
      dispatch({ type: "SET_FIELD", name, value });
      isDirtyRef.current = true;
      setShowSuggestions((prev) => ({ ...prev, [name]: false }));
      formDataRef.current = { ...formDataRef.current, [name]: value };
      handleCrossFieldLogic(name, value);
    },
    [handleCrossFieldLogic],
  );

  const handleFieldFocus = useCallback((name) => {
    if (!AUTOCOMPLETE_FIELDS.includes(name)) return;

    getAutocompleteSuggestions(name, formDataRef.current[name] || "").then(
      (suggestions) => {
        setActiveSuggestions((prev) => ({ ...prev, [name]: suggestions }));
        if (suggestions.length > 0) {
          setShowSuggestions((prev) => ({ ...prev, [name]: true }));
        }
      },
    );
  }, []);

  const checkForDuplicateCnic = useCallback(
    async (cnicValue) => {
      if (!cnicValue || cnicValue.length < 15) return false;

      const allRecords = await getAllRecords();
      const duplicate = allRecords.find(
        (record) => record.cnicNumber === cnicValue && record.id !== recordId,
      );

      if (duplicate) {
        setDuplicateInfo({
          formNumber: duplicate.formNumber || "N/A",
          fullName: duplicate.fullName || "Unknown",
          date: duplicate.date || "",
          syncStatus: duplicate.syncStatus,
        });
        setShowDuplicateWarning(true);
        return true;
      }

      return false;
    },
    [recordId],
  );

  const handleFieldBlur = useCallback(
    (name, event) => {
      setTimeout(() => {
        setShowSuggestions((prev) => ({ ...prev, [name]: false }));
      }, 200);

      if (name === "cnicNumber") {
        const cnicValue =
          event?.target?.value ?? formDataRef.current.cnicNumber;
        if (cnicValue && cnicValue.length === 15) {
          checkForDuplicateCnic(cnicValue);
        }
      }
    },
    [checkForDuplicateCnic],
  );

  const validateForm = useCallback(() => {
    const newErrors = {};

    FORM_SCHEMA.forEach((field) => {
      if (field.section === "H") return;

      if (field.showIf) {
        const { field: condField, value: condValue } = field.showIf;
        if (formDataRef.current[condField] !== condValue) return;
      }

      const value = formDataRef.current[field.name];

      if (field.required && isEmpty(value)) {
        newErrors[field.name] = `${field.label} is required`;
        return;
      }

      if (isEmpty(value)) return;

      if (field.validation && field.validation.pattern) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          newErrors[field.name] = field.validation.message;
        }
      }

      if (field.name === "cnicNumber" && !isEmpty(value)) {
        const cnicRegex = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;
        if (!cnicRegex.test(value)) {
          newErrors[field.name] = "CNIC must be in format XXXXX-XXXXXXX-X";
        }
      }

      if (field.type === "number" && !isEmpty(value)) {
        const num = parseInt(value, 10);
        if (field.name === "noOfFansRequested") {
          if (num < 1 || num > 10) {
            newErrors[field.name] = "Number of fans must be between 1 and 10";
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, []);

  const handleCopyAddress = useCallback(() => {
    const parts = [
      formDataRef.current.housePlotNumber,
      formDataRef.current.streetMohalla,
      formDataRef.current.townSectorColony,
      formDataRef.current.addressCity,
      formDataRef.current.district,
    ].filter((part) => !isEmpty(part));

    if (parts.length === 0) {
      showToast("No address fields filled above", "warning");
      return;
    }

    const address = titleCaseValue(parts.join(", "));
    dispatch({
      type: "SET_FIELD",
      name: "completeDeliveryAddress",
      value: address,
    });
    isDirtyRef.current = true;
    showToast("Address copied", "info");
  }, [showToast]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    const isValid = validateForm();
    if (!isValid) {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      showToast("Please fix the errors before submitting", "error");
      return;
    }

    for (const fieldName of AUTOCOMPLETE_FIELDS) {
      const value = formDataRef.current[fieldName];
      if (!isEmpty(value)) {
        await addAutocompleteEntry(fieldName, value);
      }
    }

    const now = new Date().toISOString();
    const finalRecord = {
      ...formDataRef.current,
      syncStatus: "pending",
      syncError: null,
      syncedAt: null,
      updatedAt: now,
    };

    let savedId = recordId;

    try {
      if (!recordId) {
        finalRecord.id = generateUUID();
        finalRecord.createdAt = now;
        savedId = await addRecord(finalRecord);
      } else {
        await updateRecord(recordId, finalRecord);
        savedId = recordId;
      }
    } catch (error) {
      console.error("Save error:", error);
      showToast("Error saving record. Please try again.", "error");
      setIsSubmitting(false);
      return;
    }

    setRecordId(savedId);
    isDirtyRef.current = false;

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }

    showToast("Form submitted successfully!", "success");

    if (isOnline) {
      syncPendingRecords().catch((error) =>
        console.error("Sync error:", error),
      );
    }

    setIsSubmitting(false);

    setTimeout(() => {
      setShowPostSubmitModal(true);
    }, 800);
  }, [isOnline, recordId, showToast, validateForm]);

  useEffect(() => {
    if (!router.isReady) return undefined;

    let cancelled = false;

    async function initForm() {
      const settings = await getAllSettings();
      if (cancelled) return;

      setAgentSettings(settings);

      if (router.query.id) {
        const record = await getRecord(router.query.id);
        if (cancelled) return;

        if (record) {
          dispatch({ type: "LOAD_RECORD", record });
          setRecordId(record.id);
        } else {
          showToast("Record not found", "error");
          router.push("/records");
        }
        return;
      }

      dispatch({ type: "SET_MULTIPLE", values: buildAgentDefaults(settings) });
    }

    initForm();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.query.id, router, showToast]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isDirtyRef.current) {
        saveDraft();
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [saveDraft]);

  useEffect(() => {
    const handleBlur = () => {
      if (isDirtyRef.current) {
        saveDraft();
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [saveDraft]);

  const renderField = (field) => {
    if (field.showIf) {
      const { field: condField, value: condValue } = field.showIf;
      if (formData[condField] !== condValue) return null;
    }

    const commonProps = {
      name: field.name,
      label: field.label,
      value: formData[field.name] || "",
      onChange: handleFieldChange,
      required: field.required,
      placeholder: field.placeholder,
      helpText: field.helpText,
      error: errors[field.name] || "",
      disabled: false,
    };

    const refCallback = (element) => {
      if (element) {
        fieldRefs.current[field.name] = element;
      }
    };

    const wrapperClass =
      field.gridSpan === "full" ? "col-span-1 sm:col-span-2" : "col-span-1";

    let inputElement = null;

    switch (field.type) {
      case "text":
        inputElement = (
          <TextInput
            {...commonProps}
            autoFormat={field.autoFormat}
            autocomplete={field.autocomplete}
            suggestions={activeSuggestions[field.name] || []}
            showSuggestions={showSuggestions[field.name] || false}
            onSuggestionSelect={handleSuggestionSelect}
            onCloseSuggestions={() =>
              setShowSuggestions((prev) => ({ ...prev, [field.name]: false }))
            }
            onFocus={() => handleFieldFocus(field.name)}
            onBlur={handleFieldBlur}
            inputRef={refCallback}
          />
        );
        break;

      case "tel":
        inputElement = (
          <TextInput
            {...commonProps}
            autoFormat={field.autoFormat}
            autocomplete={false}
            suggestions={[]}
            showSuggestions={false}
            onSuggestionSelect={() => {}}
            onFocus={() => {}}
            onBlur={handleFieldBlur}
            inputRef={refCallback}
          />
        );
        break;

      case "email":
        inputElement = (
          <TextInput
            {...commonProps}
            type="email"
            autoFormat="none"
            autocomplete={false}
            suggestions={[]}
            showSuggestions={false}
            onSuggestionSelect={() => {}}
            onFocus={() => {}}
            onBlur={() => {}}
            inputRef={refCallback}
          />
        );
        break;

      case "select":
        inputElement = (
          <SelectInput
            {...commonProps}
            options={field.options}
            inputRef={refCallback}
          />
        );
        break;

      case "radio":
        inputElement = (
          <RadioGroup
            {...commonProps}
            options={field.options}
            inputRef={refCallback}
          />
        );
        break;

      case "date":
        inputElement = <DateInput {...commonProps} inputRef={refCallback} />;
        break;

      case "textarea":
        inputElement = (
          <TextAreaInput
            {...commonProps}
            autoFormat={field.autoFormat}
            inputRef={refCallback}
          />
        );
        break;

      case "number":
        inputElement = (
          <NumberInput
            {...commonProps}
            min={field.name === "noOfFansRequested" ? 1 : undefined}
            max={field.name === "noOfFansRequested" ? 10 : undefined}
            inputRef={refCallback}
          />
        );
        break;

      default:
        return null;
    }

    let warningBanner = null;

    if (
      field.name === "connectionType" &&
      ["Commercial", "Agricultural"].includes(formData.connectionType)
    ) {
      warningBanner = (
        <WarningBanner
          message="Only Residential (Domestic) connections qualify for the E-Fan program. This application may be rejected."
          type="warning"
        />
      );
    }

    if (
      field.name === "isHomeOwner" &&
      formData.isHomeOwner === "No (Tenant)"
    ) {
      warningBanner = (
        <WarningBanner
          message="Only homeowners qualify. Tenant applications are not eligible."
          type="warning"
        />
      );
    }

    if (
      field.name === "activeInstallmentOnBill" &&
      formData.activeInstallmentOnBill === "Yes"
    ) {
      warningBanner = (
        <WarningBanner
          message="An active installment plan may disqualify this application."
          type="warning"
        />
      );
    }

    if (
      field.name === "billInApplicantName" &&
      formData.billInApplicantName === "No"
    ) {
      warningBanner = (
        <WarningBanner
          message="Bill must be in the applicant's name to qualify."
          type="warning"
        />
      );
    }

    let extraButton = null;

    if (field.name === "completeDeliveryAddress") {
      extraButton = (
        <button
          type="button"
          onClick={handleCopyAddress}
          className="mt-1 flex items-center gap-1 text-sm text-primary-600 underline"
        >
          📋 Copy from residential address fields above
        </button>
      );
    }

    return (
      <div key={field.name} className={wrapperClass}>
        {inputElement}
        {warningBanner}
        {extraButton}
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>
          {recordId ? "Edit Form" : "New Form"} | PM E-Fan Data Collection
        </title>
      </Head>

      <Layout title={recordId ? "Edit Form" : "New Form"}>
        {Object.keys(errors).length > 0 && (
          <div className="px-4 pt-4">
            <ErrorSummary errors={errors} fieldRefs={fieldRefs.current} />
          </div>
        )}

        <div className="space-y-4 px-4 py-4 pb-32">
          {SECTION_CONFIG.map((section) => {
            if (section.key === "G") {
              return (
                <FormSection
                  key="G"
                  sectionKey="G"
                  title="G. Consumer Consent & Declaration"
                  collapsible={false}
                  defaultOpen
                >
                  <div className="col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-600">
                    <p className="mb-2 font-medium text-gray-800">
                      Consumer Declaration:
                    </p>
                    <p>
                      I, the undersigned, hereby declare that all information
                      provided above is true and correct. I consent to the
                      submission of my data on the PM E-Fan Portal (efan.gov.pk)
                      by the authorised organisation, and to DISCO/NEECA
                      verifying my electricity records for eligibility purposes.
                      I understand that providing false information may result
                      in rejection of my application.
                    </p>
                    <p className="mt-3 text-xs italic text-gray-500">
                      (Consumer verbal consent obtained by field agent)
                    </p>
                  </div>
                </FormSection>
              );
            }

            const sectionFields = getFieldsBySection(section.key);
            if (!section.static && sectionFields.length === 0) return null;

            return (
              <FormSection
                key={section.key}
                sectionKey={section.key}
                title={section.label}
                collapsible={section.collapsible}
                defaultOpen={section.defaultOpen}
                isOfficeSection={section.key === "H"}
              >
                <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {sectionFields.map((field) => renderField(field))}
                </div>
              </FormSection>
            );
          })}
        </div>

        <div
          className="fixed bottom-16 left-0 right-0 flex gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.07)]"
          style={{
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            onClick={() => saveDraft()}
            disabled={isSaving}
            className="btn-secondary flex flex-1 items-center justify-center gap-2 py-3"
          >
            {isSaving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                Saving...
              </>
            ) : (
              "💾 Save Draft"
            )}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3"
            style={{ flexGrow: 2 }}
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Submitting...
              </>
            ) : (
              "✅ Submit Form"
            )}
          </button>
        </div>

        {isSaving && (
          <div className="fixed right-2 top-14 rounded-full bg-gray-800 px-2 py-1 text-xs text-white opacity-75">
            Saving...
          </div>
        )}

        <div className="pointer-events-none fixed bottom-32 left-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>

        {showDuplicateWarning && duplicateInfo && (
          <DuplicateWarningModal
            duplicateInfo={duplicateInfo}
            onContinue={() => setShowDuplicateWarning(false)}
            onCancel={() => {
              setShowDuplicateWarning(false);
              dispatch({ type: "SET_FIELD", name: "cnicNumber", value: "" });
              setTimeout(() => {
                fieldRefs.current.cnicNumber?.focus();
              }, 100);
            }}
          />
        )}

        {showPostSubmitModal && (
          <PostSubmitModal
            onNewForm={() => {
              setShowPostSubmitModal(false);
              const newDefaults = buildAgentDefaults(agentSettings);
              dispatch({ type: "RESET_FORM", defaults: newDefaults });
              setRecordId(null);
              setErrors({});
              isDirtyRef.current = false;
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onViewRecords={() => router.push("/records")}
          />
        )}
      </Layout>
    </>
  );
}
